import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { getTapesFolderPath, getTaraHomePath } from '../src';

describe('home', () => {
    it('getTaraHomePath returns path in home directory', () => {
        const result = getTaraHomePath();
        expect(result).toBe(path.join(os.homedir(), '.taraproject'));
    });

    it('getTapesFolderPath returns tapes subfolder', () => {
        const result = getTapesFolderPath();
        expect(result).toBe(path.join(os.homedir(), '.taraproject', 'tapes'));
    });
});
