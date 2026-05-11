import type { StoryModel } from '@nihonnohon/schema'
import { LoaderError } from './errors'
import { loadV1 } from './v1'

export { LoaderError } from './errors'

const LOADERS: Record<string, (raw: unknown) => StoryModel> = {
  '1': loadV1,
}

export function loadStory(rawJson: unknown): StoryModel {
  let data: unknown

  if (typeof rawJson === 'string') {
    try {
      data = JSON.parse(rawJson)
    } catch (err) {
      throw new LoaderError('PARSE_FAILED', 'Story JSON could not be parsed.', err)
    }
  } else {
    data = rawJson
  }

  const version =
    data !== null && typeof data === 'object' && 'schema_version' in data
      ? (data as Record<string, unknown>)['schema_version']
      : undefined

  if (typeof version !== 'string' || !Object.hasOwn(LOADERS, version)) {
    throw new LoaderError(
      'UNSUPPORTED_VERSION',
      `Unsupported schema version: ${String(version)}. Supported: ${Object.keys(LOADERS).join(', ')}.`
    )
  }

  return LOADERS[version](data)
}
