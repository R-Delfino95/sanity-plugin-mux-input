import {Card} from '@sanity/ui'
import {memo, Suspense} from 'react'

import {useAssetDocumentValues} from '../hooks/useAssetDocumentValues'
import {useClient} from '../hooks/useClient'
import {useDialogState} from '../hooks/useDialogState'
import {useMuxPolling} from '../hooks/useMuxPolling'
import {useSecretsDocumentValues} from '../hooks/useSecretsDocumentValues'
import type {MuxInputProps, PluginConfig} from '../util/types'
import ConfigureApi from './ConfigureApi'
import ErrorBoundaryCard from './ErrorBoundaryCard'
import {InputFallback} from './Input.styled'
import Onboard from './Onboard'
import Uploader from './Uploader'
import {useAccessControl} from '../hooks/useAccessControl'

export interface InputProps extends MuxInputProps {
  config: PluginConfig
}
const Input = (props: InputProps) => {
  const client = useClient()
  const secretDocumentValues = useSecretsDocumentValues()
  const assetDocumentValues = useAssetDocumentValues(props.value?.asset)
  const poll = useMuxPolling(props.readOnly ? undefined : assetDocumentValues?.value || undefined)
  const [dialogState, setDialogState] = useDialogState()
  const {hasConfigAccess} = useAccessControl(props.config)

  const error = secretDocumentValues.error || assetDocumentValues.error || poll.error /*||
    // @TODO move errored logic to Uploader, where handleRemoveVideo can be called
    (assetDocumentValues.value?.status === 'errored'
      ? new Error(assetDocumentValues.value.data?.errors?.messages?.join(' '))
      : undefined)
      // */
  if (error) {
    // @TODO deal with it more gracefully
    throw error
  }
  const isLoading = secretDocumentValues.isLoading || assetDocumentValues.isLoading

  return (
    <Card>
      <ErrorBoundaryCard schemaType={props.schemaType}>
        <Suspense fallback={<InputFallback />}>
          {isLoading ? (
            <InputFallback />
          ) : (
            <>
              {secretDocumentValues.value.needsSetup && !assetDocumentValues.value ? (
                <Onboard setDialogState={setDialogState} config={props.config} />
              ) : (
                <Uploader
                  {...props}
                  config={props.config}
                  onChange={props.onChange}
                  client={client}
                  secrets={secretDocumentValues.value.secrets}
                  asset={assetDocumentValues.value}
                  dialogState={dialogState}
                  setDialogState={setDialogState}
                  needsSetup={secretDocumentValues.value.needsSetup}
                />
              )}

              {dialogState === 'secrets' && hasConfigAccess && (
                <ConfigureApi
                  setDialogState={setDialogState}
                  secrets={secretDocumentValues.value.secrets}
                />
              )}
            </>
          )}
        </Suspense>
      </ErrorBoundaryCard>
    </Card>
  )
}

export default memo(Input)
