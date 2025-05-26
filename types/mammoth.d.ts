
declare module 'mammoth' {
  export interface ExtractRawTextOptions {
    styleMap?: string[];
  }

  export interface ExtractRawTextResult {
    value: string;
    messages: any[];
  }

  export function extractRawText(buffer: Buffer, options?: ExtractRawTextOptions): Promise<ExtractRawTextResult>;
}
