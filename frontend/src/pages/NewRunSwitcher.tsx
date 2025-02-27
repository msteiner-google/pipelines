import React, { useState } from 'react';
import * as JsYaml from 'js-yaml';
import { useQuery } from 'react-query';
import { QUERY_PARAMS } from 'src/components/Router';
import { isFeatureEnabled, FeatureKey } from 'src/features';
import { Apis } from 'src/lib/Apis';
import { NamespaceContext } from 'src/lib/KubeflowClient';
import { URLParser } from 'src/lib/URLParser';
import { NewRun } from './NewRun';
import NewRunV2 from './NewRunV2';
import { PageProps } from './Page';
import { isTemplateV2 } from 'src/lib/v2/WorkflowUtils';
import { V2beta1Pipeline, V2beta1PipelineVersion } from 'src/apisv2beta1/pipeline';
import { V2beta1Run } from 'src/apisv2beta1/run';
import { V2beta1RecurringRun } from 'src/apisv2beta1/recurringrun';
import { V2beta1Experiment } from 'src/apisv2beta1/experiment';

function NewRunSwitcher(props: PageProps) {
  const namespace = React.useContext(NamespaceContext);

  const urlParser = new URLParser(props);
  // Currently using two query parameters to get Run ID.
  // because v1 has two different behavior with Run ID (clone a run / start a run)
  // Will keep clone run only in v2 if run ID is existing
  // runID query by cloneFromRun will be deprecated once v1 is deprecated.
  const originalRunId = urlParser.get(QUERY_PARAMS.cloneFromRun);
  const embeddedRunId = urlParser.get(QUERY_PARAMS.fromRunId);
  const originalRecurringRunId = urlParser.get(QUERY_PARAMS.cloneFromRecurringRun);
  const [pipelineIdFromPipeline, setPipelineIdFromPipeline] = useState(
    urlParser.get(QUERY_PARAMS.pipelineId),
  );
  const experimentId = urlParser.get(QUERY_PARAMS.experimentId);
  const [pipelineVersionIdParam, setPipelineVersionIdParam] = useState(
    urlParser.get(QUERY_PARAMS.pipelineVersionId),
  );
  const existingRunId = originalRunId ? originalRunId : embeddedRunId;
  let pipelineIdFromRunOrRecurringRun;
  let pipelineVersionIdFromRunOrRecurringRun;

  // Retrieve v2 run details
  const { isSuccess: getV2RunSuccess, isFetching: v2RunIsFetching, data: v2Run } = useQuery<
    V2beta1Run,
    Error
  >(
    ['v2_run_details', existingRunId],
    () => {
      if (!existingRunId) {
        throw new Error('Run ID is missing');
      }
      return Apis.runServiceApiV2.getRun(existingRunId);
    },
    { enabled: !!existingRunId, staleTime: Infinity },
  );

  // Retrieve recurring run details
  const {
    isSuccess: getRecurringRunSuccess,
    isFetching: recurringRunIsFetching,
    data: recurringRun,
  } = useQuery<V2beta1RecurringRun, Error>(
    ['recurringRun', originalRecurringRunId],
    () => {
      if (!originalRecurringRunId) {
        throw new Error('Recurring Run ID is missing');
      }
      return Apis.recurringRunServiceApi.getRecurringRun(originalRecurringRunId);
    },
    { enabled: !!originalRecurringRunId, staleTime: Infinity },
  );

  if (v2Run !== undefined && recurringRun !== undefined) {
    throw new Error('The existence of run and recurring run should be exclusive.');
  }

  pipelineIdFromRunOrRecurringRun =
    v2Run?.pipeline_version_reference?.pipeline_id ||
    recurringRun?.pipeline_version_reference?.pipeline_id;
  pipelineVersionIdFromRunOrRecurringRun =
    v2Run?.pipeline_version_reference?.pipeline_version_id ||
    recurringRun?.pipeline_version_reference?.pipeline_version_id;

  // template string from cloned run / recurring run created by pipeline_spec
  let pipelineManifest: string | undefined;
  if (getV2RunSuccess && v2Run && v2Run.pipeline_spec) {
    pipelineManifest = JsYaml.safeDump(v2Run.pipeline_spec);
  }

  if (getRecurringRunSuccess && recurringRun && recurringRun.pipeline_spec) {
    pipelineManifest = JsYaml.safeDump(recurringRun.pipeline_spec);
  }

  const { isFetching: pipelineIsFetching, data: pipeline } = useQuery<V2beta1Pipeline, Error>(
    ['pipeline', pipelineIdFromPipeline],
    () => {
      if (!pipelineIdFromPipeline) {
        throw new Error('Pipeline ID is missing');
      }
      return Apis.pipelineServiceApiV2.getPipeline(pipelineIdFromPipeline);
    },
    { enabled: !!pipelineIdFromPipeline, staleTime: Infinity, cacheTime: 0 },
  );

  const pipelineId = pipelineIdFromPipeline || pipelineIdFromRunOrRecurringRun;
  const pipelineVersionId = pipelineVersionIdParam || pipelineVersionIdFromRunOrRecurringRun;

  const { isFetching: pipelineVersionIsFetching, data: pipelineVersion } = useQuery<
    V2beta1PipelineVersion,
    Error
  >(
    ['pipelineVersion', pipelineVersionIdParam],
    () => {
      if (!(pipelineId && pipelineVersionId)) {
        throw new Error('Pipeline id or pipeline Version ID is missing');
      }
      return Apis.pipelineServiceApiV2.getPipelineVersion(pipelineId, pipelineVersionId);
    },
    { enabled: !!pipelineId && !!pipelineVersionId, staleTime: Infinity, cacheTime: 0 },
  );

  const pipelineSpecInVersion = pipelineVersion?.pipeline_spec;
  const templateStrFromSpec = pipelineSpecInVersion ? JsYaml.safeDump(pipelineSpecInVersion) : '';

  const {
    isSuccess: isTemplatePullSuccessFromPipeline,
    isFetching: pipelineTemplateStrIsFetching,
    data: templateStrFromTemplate,
  } = useQuery<string, Error>(
    ['ApiPipelineVersionTemplate', pipelineVersionIdParam],
    async () => {
      if (!pipelineVersionId) {
        return '';
      }
      const template = await Apis.pipelineServiceApi.getPipelineVersionTemplate(pipelineVersionId);
      return template?.template || '';
    },
    { enabled: !!pipelineVersion, staleTime: Infinity, cacheTime: 0 },
  );

  const { data: experiment } = useQuery<V2beta1Experiment, Error>(
    ['experiment', experimentId],
    async () => {
      if (!experimentId) {
        throw new Error('Experiment ID is missing');
      }
      return Apis.experimentServiceApiV2.getExperiment(experimentId);
    },
    { enabled: !!experimentId, staleTime: Infinity },
  );

  const templateString =
    pipelineManifest ?? isTemplateV2(templateStrFromSpec)
      ? templateStrFromSpec
      : templateStrFromTemplate;

  if (isFeatureEnabled(FeatureKey.V2_ALPHA)) {
    if (
      (getV2RunSuccess || getRecurringRunSuccess || isTemplatePullSuccessFromPipeline) &&
      isTemplateV2(templateString || '')
    ) {
      return (
        <NewRunV2
          {...props}
          namespace={namespace}
          existingRunId={existingRunId}
          existingRun={v2Run}
          existingRecurringRunId={originalRecurringRunId}
          existingRecurringRun={recurringRun}
          existingPipeline={pipeline}
          handlePipelineIdChange={setPipelineIdFromPipeline}
          existingPipelineVersion={pipelineVersion}
          handlePipelineVersionIdChange={setPipelineVersionIdParam}
          templateString={templateString}
          chosenExperiment={experiment}
        />
      );
    }
  }

  // Use experiment ID to create new run
  // Currently use NewRunV1 as default
  // TODO(jlyaoyuli): set v2 as default once v1 is deprecated.
  if (
    v2RunIsFetching ||
    recurringRunIsFetching ||
    pipelineIsFetching ||
    pipelineVersionIsFetching ||
    pipelineTemplateStrIsFetching
  ) {
    return <div>Currently loading pipeline information</div>;
  }
  return (
    <NewRun
      {...props}
      namespace={namespace}
      existingPipelineId={pipelineIdFromPipeline}
      handlePipelineIdChange={setPipelineIdFromPipeline}
      existingPipelineVersionId={pipelineVersionIdParam}
      handlePipelineVersionIdChange={setPipelineVersionIdParam}
    />
  );
}

export default NewRunSwitcher;
