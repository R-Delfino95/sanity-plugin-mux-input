import {DocumentVideoIcon, UploadIcon} from '@sanity/icons'
import {Box, Button, Card, Checkbox, Dialog, Flex, Label, Radio, Stack, Text} from '@sanity/ui'
import {uuid} from '@sanity/uuid'
import LanguagesList from 'iso-639-1'
import {useEffect, useId, useReducer, useRef} from 'react'
import {FormField} from 'sanity'

import formatBytes from '../util/formatBytes'
import {
  type AutogeneratedTextTrack,
  type CustomTextTrack,
  isAutogeneratedTrack,
  isCustomTextTrack,
  type MuxNewAssetSettings,
  type PluginConfig,
  type Secrets,
  type SupportedMuxLanguage,
  type UploadConfig,
  type UploadTextTrack,
} from '../util/types'
import TextTracksEditor, {type TrackAction} from './TextTracksEditor'
import PlaybackPolicy from './uploadConfiguration/PlaybackPolicy'
import type {StagedUpload} from './Uploader'

export type UploadConfigurationStateAction =
  | {action: 'encoding_tier'; value: UploadConfig['encoding_tier']}
  | {action: 'max_resolution_tier'; value: UploadConfig['max_resolution_tier']}
  | {action: 'mp4_support'; value: UploadConfig['mp4_support']}
  | {action: 'normalize_audio'; value: UploadConfig['normalize_audio']}
  | {action: 'signed_policy'; value: UploadConfig['signed_policy']}
  | {action: 'public_policy'; value: UploadConfig['public_policy']}
  | TrackAction

const ENCODING_OPTIONS = [
  {value: 'smart', label: 'Smart'},
  {value: 'baseline', label: 'Baseline'},
] as const satisfies {value: UploadConfig['encoding_tier']; label: string}[]

const RESOLUTION_TIERS = [
  {value: '1080p', label: '1080p'},
  {value: '1440p', label: '1440p (2k)'},
  {value: '2160p', label: '2160p (4k)'},
] as const satisfies {value: UploadConfig['max_resolution_tier']; label: string}[]

/**
 * The modal for configuring a staged upload. Handles triggering of the asset
 * upload, even if no modal needs to be shown.
 *
 * @returns
 */
export default function UploadConfiguration({
  stagedUpload,
  secrets,
  pluginConfig,
  startUpload,
  onClose,
}: {
  stagedUpload: StagedUpload
  secrets: Secrets
  pluginConfig: PluginConfig
  startUpload: (settings: MuxNewAssetSettings) => void
  onClose: () => void
}) {
  const id = useId()
  const autoTextTracks = useRef<NonNullable<UploadConfig['text_tracks']>>(
    pluginConfig.encoding_tier === 'smart' && pluginConfig.defaultAutogeneratedSubtitleLang
      ? [
          {
            _id: uuid(),
            type: 'autogenerated',
            language_code: pluginConfig.defaultAutogeneratedSubtitleLang,
            name: LanguagesList.getNativeName(pluginConfig.defaultAutogeneratedSubtitleLang),
          } satisfies AutogeneratedTextTrack,
        ]
      : []
  ).current

  const [config, dispatch] = useReducer(
    (prev: UploadConfig, action: UploadConfigurationStateAction) => {
      switch (action.action) {
        case 'encoding_tier':
          // If encoding tier switches to baseline, remove smart-only features
          if (action.value === 'baseline') {
            return Object.assign({}, prev, {
              encoding_tier: action.value,
              mp4_support: 'none',
              max_resolution_tier: '1080p',
              text_tracks: prev.text_tracks?.filter(({type}) => type !== 'autogenerated'),
              public_policy: true,
              signed_policy: false,
            })
            // If encoding tier switches to smart, add back in default smart features
          }
          return Object.assign({}, prev, {
            encoding_tier: action.value,
            mp4_support: pluginConfig.mp4_support,
            max_resolution_tier: pluginConfig.max_resolution_tier,
            text_tracks: [...autoTextTracks, ...(prev.text_tracks || [])],
          })

        case 'mp4_support':
        case 'max_resolution_tier':
        case 'normalize_audio':
        case 'signed_policy':
          return Object.assign({}, prev, {[action.action]: action.value})
        case 'public_policy':
          return Object.assign({}, prev, {[action.action]: action.value})
        // Updating individual tracks
        case 'track': {
          const text_tracks = [...prev.text_tracks]
          const target_track_i = text_tracks.findIndex(({_id}) => _id === action.id)
          // eslint-disable-next-line default-case
          switch (action.subAction) {
            case 'add':
              // Exit early if track already exists
              if (target_track_i !== -1) break
              text_tracks.push({
                _id: action.id,
                ...action.value,
              } as AutogeneratedTextTrack)
              break
            case 'update':
              if (target_track_i === -1) break
              text_tracks[target_track_i] = {
                ...text_tracks[target_track_i],
                ...action.value,
              } as UploadTextTrack
              break
            case 'delete':
              if (target_track_i === -1) break
              text_tracks.splice(target_track_i, 1)
              break
          }
          return Object.assign({}, prev, {text_tracks})
        }
        default:
          return prev
      }
    },
    {
      encoding_tier: pluginConfig.encoding_tier,
      max_resolution_tier: pluginConfig.max_resolution_tier,
      mp4_support: pluginConfig.mp4_support,
      signed_policy: secrets.enableSignedUrls && pluginConfig.defaultSigned,
      public_policy: true,
      normalize_audio: pluginConfig.normalize_audio,
      text_tracks: autoTextTracks,
    } as UploadConfig
  )

  // If user-provided config is disabled, begin the upload immediately with
  // the developer-specified values from the schema or config or defaults.
  // This can include auto-generated subtitles!
  const {disableTextTrackConfig, disableUploadConfig} = pluginConfig
  const skipConfig = disableTextTrackConfig && disableUploadConfig
  useEffect(() => {
    if (skipConfig) startUpload(formatUploadConfig(config))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (skipConfig) return null

  const maxSupportedResolution = RESOLUTION_TIERS.findIndex(
    (rt) => rt.value === pluginConfig.max_resolution_tier
  )
  return (
    <Dialog
      animate
      open
      id="upload-configuration"
      zOffset={1000}
      width={1}
      header="Configure Mux Upload"
      onClose={onClose}
    >
      <Stack padding={4} space={2}>
        <Label size={3}>FILE TO UPLOAD</Label>
        <Card
          tone="transparent"
          border
          padding={3}
          paddingY={4}
          style={{borderRadius: '0.1865rem'}}
        >
          <Flex gap={2}>
            <DocumentVideoIcon fontSize="2em" />
            <Stack space={2}>
              <Text textOverflow="ellipsis" as="h2" size={3}>
                {stagedUpload.type === 'file' ? stagedUpload.files[0].name : stagedUpload.url}
              </Text>
              <Text as="p" size={1} muted>
                {stagedUpload.type === 'file'
                  ? `Direct File Upload (${formatBytes(stagedUpload.files[0].size)})`
                  : 'File From URL (Unknown size)'}
              </Text>
            </Stack>
          </Flex>
        </Card>
        {!disableUploadConfig && (
          <Stack space={3} paddingBottom={2}>
            <FormField
              title="Encoding Tier"
              description={
                <>
                  The encoding tier informs the cost, quality, and available platform features for
                  the asset.{' '}
                  <a
                    href="https://docs.mux.com/guides/use-encoding-tiers"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    See the Mux guide for more details.
                  </a>
                </>
              }
            >
              <Flex gap={3}>
                {ENCODING_OPTIONS.map(({value, label}) => {
                  const inputId = `${id}--encodingtier-${value}`
                  return (
                    <Flex key={value} align="center" gap={2}>
                      <Radio
                        checked={config.encoding_tier === value}
                        name="asset-encodingtier"
                        onChange={(e) =>
                          dispatch({
                            action: 'encoding_tier' as const,
                            value: e.currentTarget.value as UploadConfig['encoding_tier'],
                          })
                        }
                        value={value}
                        id={inputId}
                      />
                      <Text as="label" htmlFor={inputId}>
                        {label}
                      </Text>
                    </Flex>
                  )
                })}
              </Flex>
            </FormField>

            {config.encoding_tier === 'smart' && maxSupportedResolution > 0 && (
              <FormField
                title="Resolution Tier"
                description={
                  <>
                    The maximum{' '}
                    <a
                      href="https://docs.mux.com/api-reference#video/operation/create-direct-upload"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      resolution_tier
                    </a>{' '}
                    your asset is encoded, stored, and streamed at.
                  </>
                }
              >
                <Flex gap={3} wrap={'wrap'}>
                  {RESOLUTION_TIERS.map(({value, label}, index) => {
                    const inputId = `${id}--type-${value}`

                    if (index > maxSupportedResolution) return null

                    return (
                      <Flex key={value} align="center" gap={2}>
                        <Radio
                          checked={config.max_resolution_tier === value}
                          name="asset-resolutiontier"
                          onChange={(e) =>
                            dispatch({
                              action: 'max_resolution_tier',
                              value: e.currentTarget.value as UploadConfig['max_resolution_tier'],
                            })
                          }
                          value={value}
                          id={inputId}
                        />
                        <Text as="label" htmlFor={inputId}>
                          {label}
                        </Text>
                      </Flex>
                    )
                  })}
                </Flex>
              </FormField>
            )}

            {config.encoding_tier === 'smart' && (
              <FormField title="Additional Configuration">
                <Stack space={2}>
                  <PlaybackPolicy id={id} config={config} secrets={secrets} dispatch={dispatch} />

                  {config.encoding_tier === 'smart' && (
                    <Flex align="center" gap={2}>
                      <Checkbox
                        id={`${id}--mp4_support`}
                        style={{display: 'block'}}
                        name="mp4_support"
                        required
                        checked={config.mp4_support === 'standard'}
                        onChange={(e) =>
                          dispatch({
                            action: 'mp4_support',
                            value: e.currentTarget.checked ? 'standard' : 'none',
                          })
                        }
                      />
                      <Text>
                        <label htmlFor={`${id}--mp4_support`}>
                          MP4 support (allow downloading)
                        </label>
                      </Text>
                    </Flex>
                  )}
                </Stack>
              </FormField>
            )}
          </Stack>
        )}

        {!disableTextTrackConfig && config.encoding_tier === 'smart' && (
          <TextTracksEditor
            tracks={config.text_tracks}
            dispatch={dispatch}
            defaultLang={pluginConfig.defaultAutogeneratedSubtitleLang}
          />
        )}

        <Box marginTop={4}>
          <Button
            disabled={
              config.encoding_tier === 'smart' && !config.public_policy && !config.signed_policy
            }
            icon={UploadIcon}
            text="Upload"
            tone="positive"
            onClick={() => startUpload(formatUploadConfig(config))}
          />
        </Box>
      </Stack>
    </Dialog>
  )
}

function setPlaybackPolicy(config: UploadConfig): MuxNewAssetSettings['playback_policy'] {
  const playback_policy: MuxNewAssetSettings['playback_policy'] = []
  if (config.public_policy) {
    playback_policy.push('public')
  }
  if (config.signed_policy) {
    playback_policy.push('signed')
  }
  return playback_policy
}

function formatUploadConfig(config: UploadConfig): MuxNewAssetSettings {
  const generated_subtitles = config.text_tracks
    .filter<AutogeneratedTextTrack>(isAutogeneratedTrack)
    .map<{name: string; language_code: SupportedMuxLanguage}>((track) => ({
      name: track.name,
      language_code: track.language_code,
    }))

  return {
    input: [
      {
        type: 'video',
        generated_subtitles: generated_subtitles.length > 0 ? generated_subtitles : undefined,
      },
      ...config.text_tracks.filter<CustomTextTrack>(isCustomTextTrack).reduce(
        (acc, track) => {
          if (track.language_code && track.file && track.name) {
            acc.push({
              url: track.file.contents,
              type: 'text',
              text_type: track.type === 'subtitles' ? 'subtitles' : undefined,
              language_code: track.language_code,
              name: track.name,
              closed_captions: track.type === 'captions',
            })
          }
          return acc
        },
        [] as NonNullable<MuxNewAssetSettings['input']>
      ),
    ],
    mp4_support: config.mp4_support,
    playback_policy: setPlaybackPolicy(config),
    max_resolution_tier: config.max_resolution_tier,
    encoding_tier: config.encoding_tier,
    normalize_audio: config.normalize_audio,
  }
}
