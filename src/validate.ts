export const failure = (message: string) => {
  throw new Error(message)
}

export const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message)
  }
}
