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

from typing import Dict

from google_cloud_pipeline_components.types.artifact_types import VertexEndpoint
from kfp.dsl import ConcatPlaceholder
from kfp.dsl import container_component
from kfp.dsl import ContainerSpec
from kfp.dsl import Output
from kfp.dsl import OutputPath


@container_component
def endpoint_create(
    project: str,
    display_name: str,
    gcp_resources: OutputPath(str),
    endpoint: Output[VertexEndpoint],
    location: str = 'us-central1',
    description: str = '',
    labels: Dict[str, str] = {},
    encryption_spec_key_name: str = '',
    network: str = '',
):
  # fmt: off
  """Creates a Google Cloud Vertex Endpoint and waits for it to be ready.

  For more details, see
  https://cloud.google.com/vertex-ai/docs/reference/rest/v1/projects.locations.endpoints/create.

  Args:
      project (str):
        Required. Project to create the endpoint.
      location (Optional[str]):
        Location to create the endpoint. If not set,
        default to us-central1.
      display_name (str):
        Required. The user-defined name of the Endpoint. The
        name can be up to 128 characters long and can be consist of any UTF-8
        characters.
      description (Optional[str]):
        The description of the Endpoint.
      labels (Optional[dict]):
        The labels with user-defined metadata to
        organize your Endpoints.  Label keys and values can be no longer than
        64 characters (Unicode codepoints), can only contain lowercase
        letters, numeric characters, underscores and dashes. International
        characters are allowed.  See https://goo.gl/xmQnxf for more
        information and examples of labels.
      encryption_spec_key_name (Optional[str]):
        Customer-managed encryption
        key spec for an Endpoint. If set, this Endpoint and all of this
        Endoint's sub-resources will be secured by this key. Has the form:
        ``projects/my-project/locations/my-location/keyRings/my-kr/cryptoKeys/my-key``.
        The key needs to be in the same region as where the compute resource
        is created.  If set, this Endpoint and all sub-resources of this
        Endpoint will be secured by this key.
      network (Optional[str]):
        The full name of the Google Compute Engine
        network to which the Endpoint should be peered. Private services
        access must already be configured for the network. If left
        unspecified, the Endpoint is not peered with any network.
        [Format](https://cloud.google.com/compute/docs/reference/rest/v1/networks/insert):
        projects/{project}/global/networks/{network}. Where {project} is a
        project number, as in '12345', and {network} is network name.

  Returns:
      endpoint (google.VertexEndpoint):
          Artifact tracking the created endpoint.
      gcp_resources (str):
          Serialized gcp_resources proto tracking the create endpoint's long
          running operation.

          For more details, see
          https://github.com/kubeflow/pipelines/blob/master/components/google-cloud/google_cloud_pipeline_components/proto/README.md.
  """
  # fmt: on
  return ContainerSpec(
      image='gcr.io/ml-pipeline/google-cloud-pipeline-components:2.0.0b1',
      command=[
          'python3',
          '-u',
          '-m',
          'google_cloud_pipeline_components.container.v1.endpoint.create_endpoint.launcher',
      ],
      args=[
          '--type',
          'CreateEndpoint',
          '--payload',
          ConcatPlaceholder([
              '{',
              '"display_name": "',
              display_name,
              '"',
              ', "description": "',
              description,
              '"',
              ', "labels": ',
              labels,
              ', "encryption_spec": {"kms_key_name":"',
              encryption_spec_key_name,
              '"}',
              ', "network": "',
              network,
              '"',
              '}',
          ]),
          '--project',
          project,
          '--location',
          location,
          '--gcp_resources',
          gcp_resources,
          '--executor_input',
          '{{$}}',
      ],
  )
