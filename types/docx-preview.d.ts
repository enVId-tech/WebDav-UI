declare module 'docx-preview' {
  export interface DocxRenderOptions {
    className?: string;
    inWrapper?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    useBase64URL?: boolean;
    experimental?: boolean;
    [key: string]: unknown;
  }

  export function renderAsync(
    data: ArrayBuffer | Uint8Array,
    container: HTMLElement,
    styleTemplate?: (doc: Document) => void,
    options?: DocxRenderOptions
  ): Promise<void>;
}
