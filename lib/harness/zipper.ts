import JSZip from 'jszip'

export interface ZipEntry {
  path: string
  content: string
}

export async function createHarnessZip(files: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.path, file.content)
  }
  return zip.generateAsync({ type: 'uint8array' })
}
