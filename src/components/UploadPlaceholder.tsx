import {PlugIcon, SearchIcon, UploadIcon} from '@sanity/icons'
import {DocumentVideoIcon} from '@sanity/icons'
import {Button, Card, Flex, Inline, Text} from '@sanity/ui'
import {useCallback} from 'react'

import type {SetDialogState} from '../hooks/useDialogState'
import {FileInputButton, type FileInputButtonProps} from './FileInputButton'
import {useAccessControl} from '../hooks/useAccessControl'
import {PluginConfig} from '../util/types'

interface UploadPlaceholderProps {
  setDialogState: SetDialogState
  readOnly: boolean
  hovering: boolean
  needsSetup: boolean
  onSelect: FileInputButtonProps['onSelect']
  config: PluginConfig
}
export default function UploadPlaceholder(props: UploadPlaceholderProps) {
  const {setDialogState, readOnly, onSelect, hovering, needsSetup} = props
  const handleBrowse = useCallback(() => setDialogState('select-video'), [setDialogState])
  const handleConfigureApi = useCallback(() => setDialogState('secrets'), [setDialogState])
  const {hasConfigAccess} = useAccessControl(props.config)

  return (
    <Card
      sizing="border"
      tone={readOnly ? 'transparent' : 'inherit'}
      border
      radius={2}
      paddingX={3}
      paddingY={1}
      style={hovering ? {borderColor: 'transparent'} : undefined}
    >
      <Flex
        align="center"
        justify="space-between"
        gap={4}
        direction={['column', 'column', 'row']}
        paddingY={2}
        sizing="border"
      >
        <Flex align="center" justify="flex-start" gap={2} flex={1}>
          <Flex justify="center">
            <Text muted>
              <DocumentVideoIcon />
            </Text>
          </Flex>
          <Flex justify="center">
            <Text size={1} muted>
              Drag video or paste URL here
            </Text>
          </Flex>
        </Flex>
        <Inline space={2}>
          <FileInputButton
            mode="bleed"
            tone="default"
            icon={UploadIcon}
            text="Upload"
            onSelect={onSelect}
          />
          <Button mode="bleed" icon={SearchIcon} text="Select" onClick={handleBrowse} />

          {hasConfigAccess && (
            <Button
              padding={3}
              radius={3}
              tone={needsSetup ? 'critical' : undefined}
              onClick={handleConfigureApi}
              icon={PlugIcon}
              mode="bleed"
              title="Configure plugin credentials"
            />
          )}
        </Inline>
      </Flex>
    </Card>
  )
}
