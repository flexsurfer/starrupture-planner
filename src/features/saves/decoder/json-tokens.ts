import { TokenType, type ParsedTokenInfo } from '@streamparser/json';
import { SaveImportError } from '../import-error';

const punctuation: Record<string, TokenType> = {
    '{': TokenType.LEFT_BRACE, '}': TokenType.RIGHT_BRACE, '[': TokenType.LEFT_BRACKET,
    ']': TokenType.RIGHT_BRACKET, ':': TokenType.COLON, ',': TokenType.COMMA,
};
const whitespace = (char: string) => char === ' ' || char === '\n' || char === '\r' || char === '\t';
const MAX_TOKEN_CHARS = 4 * 1024 * 1024;

/** Tokenize bounded chunks; native JSON.parse preserves escapes, lone surrogates and numbers.
 * The streaming TokenParser validates the enclosing object/array grammar.
 */
export function createJsonTokenizer(onToken: (token: ParsedTokenInfo.ParsedTokenInfo) => void) {
    let mode: 'string' | 'literal' | null = null;
    let escaped = false, offset = 0, tokenOffset = 0, tokenLength = 0;
    let parts: string[] = [];
    const append = (part: string) => {
        tokenLength += part.length;
        if (tokenLength > MAX_TOKEN_CHARS) throw new SaveImportError('complexity');
        parts.push(part);
    };
    const finish = () => {
        const value: unknown = JSON.parse(parts.join(''));
        const token = typeof value === 'string' ? TokenType.STRING : typeof value === 'number' ? TokenType.NUMBER
            : value === true ? TokenType.TRUE : value === false ? TokenType.FALSE : TokenType.NULL;
        onToken({ token, value: value as string | number | boolean | null, offset: tokenOffset });
        parts = [];
        tokenLength = 0;
        mode = null;
    };
    return {
        write(text: string) {
            let start = 0;
            for (let index = 0; index < text.length; index++) {
                const char = text[index];
                if (mode === 'string') {
                    if (escaped) escaped = false;
                    else if (char === '\\') escaped = true;
                    else if (char === '"') { append(text.slice(start, index + 1)); finish(); start = index + 1; }
                    continue;
                }
                const mark = punctuation[char];
                const space = whitespace(char);
                if (mode === 'literal') {
                    if (mark === undefined && !space && char !== '"') continue;
                    append(text.slice(start, index));
                    finish();
                }
                if (mark !== undefined) onToken({ token: mark, value: char, offset: offset + index });
                else if (!space) {
                    start = index;
                    tokenOffset = offset + index;
                    mode = char === '"' ? 'string' : 'literal';
                    continue;
                }
                start = index + 1;
            }
            if (mode) append(text.slice(start));
            offset += text.length;
        },
        end() { if (mode) finish(); },
    };
}
