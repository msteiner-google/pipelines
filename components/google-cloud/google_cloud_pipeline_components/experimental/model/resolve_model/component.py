# Copyright 2023 The Kubeflow Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
from google_cloud_pipeline_components.types.artifact_types import VertexModel
from kfp.dsl import container_component
from kfp.dsl import ContainerSpec
from kfp.dsl import Output
from kfp.dsl import OutputPath


@container_component
def resolve_vertex_model(
    gcp_resources: OutputPath(str),
    model: Output[VertexModel],
    model_name: str,
    model_version: str = '',
):
  """Resolves a model artifact or string inputs to an existing Vertex model.

  Args:
    model_name (str): Vertex model resource name in the format of
      projects/{project}/locations/{location}/models/{model} or
      projects/{project}/locations/{location}/models/{model}@{model_version_id
      or model_version_alias}.
    model_version (Optional[str]): The desired Vertex Model version to resolve.
      If model_name and model_version are provided, model_version will override
      any version or alias if present in model_name.

  Returns:
      model (google.VertexModel):
          Artifact of the Vertex Model.
      gcp_resources (str):
          Serialized gcp_resources proto tracking the Vertex model.

          For more details, see
          https://github.com/kubeflow/pipelines/blob/master/components/google-cloud/google_cloud_pipeline_components/proto/README.md.
  """
  return ContainerSpec(
      image='gcr.io/ml-pipeline/google-cloud-pipeline-components:latest',
      command=[
          'python3',
          '-u',
          '-m',
          'google_cloud_pipeline_components.container.experimental.model.resolve_model.resolve_model',
      ],
      args=[
          '--model_name',
          model_name,
          '--model_version',
          model_version,
          '--gcp_resources',
          gcp_resources,
          '--executor_input',
          '{{$}}',
      ],
  )
