export function decodeMultipartFilename(value) {
  if (typeof value !== 'string' || [...value].every((character) => character.charCodeAt(0) <= 127)) return value

  const decoded = Buffer.from(value, 'latin1').toString('utf8')
  const isValidUtf8 = !decoded.includes('\uFFFD')
  const roundTrips = Buffer.from(decoded, 'utf8').toString('latin1') === value

  return isValidUtf8 && roundTrips ? decoded : value
}
