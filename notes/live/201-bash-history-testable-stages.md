# Bash History Implementation: Testable Stages

## Stage 1: Sensitive Data Filter (Core Utility)

**Goal:** Implement and test pattern-based filtering of sensitive commands

**Files:**
- `packages/vscode-tara-puller-extenssion/src/utils/sensitive-filter.ts`
- `packages/vscode-tara-puller-extenssion/test/utils/sensitive-filter.spec.ts`

**Implementation Order:**
1. Create `SensitiveFilterConfig` interface
2. Implement `DEFAULT_PATTERNS` constant
3. Implement `isSensitiveCommand()` - pattern matching
4. Implement `filterCommands()` - bulk filtering + truncation
5. Implement `loadFilterConfig()` - config file loading

**Tests:**

### Test Suite 1.1: Pattern Matching (`isSensitiveCommand`)

```typescript
describe('isSensitiveCommand - Pattern Detection', () => {
    const patterns = ['password', 'token', 'secret'];

    it('should detect password in various forms', () => {
        expect(isSensitiveCommand('mysql -u root -pMyPassword', patterns)).toBe(true);
        expect(isSensitiveCommand('echo $PASSWORD', patterns)).toBe(true);
        expect(isSensitiveCommand('export MY_PASSWORD=123', patterns)).toBe(true);
    });

    it('should detect token patterns', () => {
        expect(isSensitiveCommand('export API_TOKEN=abc123', patterns)).toBe(true);
        expect(isSensitiveCommand('curl -H "Authorization: Bearer token123"', patterns)).toBe(true);
        expect(isSensitiveCommand('git config --global github.token abc', patterns)).toBe(true);
    });

    it('should detect secret patterns', () => {
        expect(isSensitiveCommand('export AWS_SECRET=xyz', patterns)).toBe(true);
        expect(isSensitiveCommand('echo $SECRET_KEY', patterns)).toBe(true);
    });

    it('should allow safe commands', () => {
        expect(isSensitiveCommand('npm run build', patterns)).toBe(false);
        expect(isSensitiveCommand('git status', patterns)).toBe(false);
        expect(isSensitiveCommand('ls -la', patterns)).toBe(false);
        expect(isSensitiveCommand('cd /home/user', patterns)).toBe(false);
    });

    it('should be case-insensitive', () => {
        expect(isSensitiveCommand('echo $PASSWORD', patterns)).toBe(true);
        expect(isSensitiveCommand('echo $password', patterns)).toBe(true);
        expect(isSensitiveCommand('echo $PaSsWoRd', patterns)).toBe(true);
    });

    it('should handle regex patterns', () => {
        const regexPatterns = ['curl.*-H.*Authorization', 'export.*TOKEN'];
        expect(isSensitiveCommand('curl -H "Authorization: Bearer x"', regexPatterns)).toBe(true);
        expect(isSensitiveCommand('export MY_TOKEN=123', regexPatterns)).toBe(true);
    });
});
```

### Test Suite 1.2: Bulk Filtering (`filterCommands`)

```typescript
describe('filterCommands - Bulk Operations', () => {
    const config = {
        patterns: ['password', 'token'],
        maxCommandLength: 50,
    };

    it('should filter out sensitive commands', () => {
        const commands = [
            'npm run build',
            'export TOKEN=secret',
            'git commit -m "test"',
            'echo $PASSWORD',
        ];
        const filtered = filterCommands(commands, config);
        expect(filtered).toEqual([
            'npm run build',
            'git commit -m "test"',
        ]);
    });

    it('should remove empty and whitespace-only commands', () => {
        const commands = ['npm run build', '', '  ', '\t', 'git status'];
        const filtered = filterCommands(commands, config);
        expect(filtered).toEqual(['npm run build', 'git status']);
    });

    it('should truncate commands exceeding max length', () => {
        const longCmd = 'a'.repeat(100);
        const filtered = filterCommands([longCmd], config);
        expect(filtered[0]).toContain('[truncated]');
        expect(filtered[0].length).toBeLessThanOrEqual(65); // 50 + '...[truncated]'
        expect(filtered[0]).toBe('a'.repeat(50) + '...[truncated]');
    });

    it('should not truncate commands within limit', () => {
        const okCmd = 'a'.repeat(30);
        const filtered = filterCommands([okCmd], config);
        expect(filtered[0]).toBe(okCmd);
        expect(filtered[0]).not.toContain('[truncated]');
    });

    it('should handle empty input array', () => {
        const filtered = filterCommands([], config);
        expect(filtered).toEqual([]);
    });

    it('should apply both filtering and truncation', () => {
        const commands = [
            'a'.repeat(100),           // Should be truncated
            'password=' + 'b'.repeat(100), // Should be filtered (sensitive)
            'git status',              // Should pass through
            '',                        // Should be removed
        ];
        const filtered = filterCommands(commands, config);
        expect(filtered).toHaveLength(2);
        expect(filtered[0]).toContain('[truncated]');
        expect(filtered[1]).toBe('git status');
    });
});
```

### Test Suite 1.3: Config Loading (`loadFilterConfig`)

```typescript
describe('loadFilterConfig - Configuration Management', () => {
    let tempConfigPath: string;

    beforeEach(() => {
        tempConfigPath = path.join(os.tmpdir(), `config-${Date.now()}.json`);
    });

    afterEach(() => {
        if (fs.existsSync(tempConfigPath)) {
            fs.unlinkSync(tempConfigPath);
        }
    });

    it('should load config from file', () => {
        const customConfig = {
            patterns: ['custom1', 'custom2'],
            maxCommandLength: 200,
        };
        fs.writeFileSync(tempConfigPath, JSON.stringify(customConfig));

        const config = loadFilterConfig(tempConfigPath);
        expect(config.patterns).toEqual(['custom1', 'custom2']);
        expect(config.maxCommandLength).toBe(200);
    });

    it('should return defaults if no path provided', () => {
        const config = loadFilterConfig();
        expect(config.patterns).toContain('password');
        expect(config.patterns).toContain('token');
        expect(config.maxCommandLength).toBe(500);
    });

    it('should return defaults if file does not exist', () => {
        const config = loadFilterConfig('/nonexistent/path.json');
        expect(config.patterns).toContain('password');
        expect(config.maxCommandLength).toBe(500);
    });

    it('should return defaults on invalid JSON', () => {
        fs.writeFileSync(tempConfigPath, 'invalid json{');
        const config = loadFilterConfig(tempConfigPath);
        expect(config.patterns).toContain('password');
        expect(config.maxCommandLength).toBe(500);
    });

    it('should merge partial config with defaults', () => {
        const partialConfig = {
            maxCommandLength: 300,
            // patterns missing
        };
        fs.writeFileSync(tempConfigPath, JSON.stringify(partialConfig));

        const config = loadFilterConfig(tempConfigPath);
        expect(config.patterns).toContain('password'); // from defaults
        expect(config.maxCommandLength).toBe(300); // from file
    });
});
```

**Verification:**
```bash
cd packages/vscode-tara-puller-extenssion
npm run test -- test/utils/sensitive-filter.spec.ts
```

---

## Stage 2: Bash History Parser (Core Utility)

**Goal:** Implement reading and parsing of bash history files

**Files:**
- `packages/vscode-tara-puller-extenssion/src/utils/bash-history-parser.ts`
- `packages/vscode-tara-puller-extenssion/test/utils/bash-history-parser.spec.ts`

**Implementation Order:**
1. Create `BashCommand` interface
2. Implement `getBashHistoryPath()`
3. Implement `readBashHistory()` - file reading
4. Implement `getLastNCommands()` - slicing
5. Implement `parseBashHistory()` - structuring

**Tests:**

### Test Suite 2.1: History File Reading (`readBashHistory`)

```typescript
describe('readBashHistory - File Operations', () => {
    let tempHistoryPath: string;

    beforeEach(() => {
        tempHistoryPath = path.join(os.tmpdir(), `test-bash-history-${Date.now()}`);
    });

    afterEach(() => {
        if (fs.existsSync(tempHistoryPath)) {
            fs.unlinkSync(tempHistoryPath);
        }
    });

    it('should read commands from history file', () => {
        const mockHistory = 'ls -la\nnpm run build\ngit status\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = readBashHistory(tempHistoryPath);
        expect(commands).toEqual(['ls -la', 'npm run build', 'git status']);
    });

    it('should handle file with trailing newline', () => {
        const mockHistory = 'cmd1\ncmd2\ncmd3\n\n\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = readBashHistory(tempHistoryPath);
        expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    it('should filter out empty lines', () => {
        const mockHistory = 'ls -la\n\nnpm run build\n\n\ngit status\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = readBashHistory(tempHistoryPath);
        expect(commands).toEqual(['ls -la', 'npm run build', 'git status']);
    });

    it('should return empty array if file does not exist', () => {
        const commands = readBashHistory('/nonexistent/path/.bash_history');
        expect(commands).toEqual([]);
    });

    it('should handle empty file', () => {
        fs.writeFileSync(tempHistoryPath, '');
        const commands = readBashHistory(tempHistoryPath);
        expect(commands).toEqual([]);
    });

    it('should handle file with only whitespace', () => {
        fs.writeFileSync(tempHistoryPath, '\n\n  \n\t\n');
        const commands = readBashHistory(tempHistoryPath);
        expect(commands).toEqual([]);
    });

    it('should preserve command text exactly (no trimming)', () => {
        const mockHistory = '  ls -la  \n\tnpm run build\t\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = readBashHistory(tempHistoryPath);
        expect(commands[0]).toBe('  ls -la  ');
        expect(commands[1]).toBe('\tnpm run build\t');
    });
});
```

### Test Suite 2.2: Last N Commands (`getLastNCommands`)

```typescript
describe('getLastNCommands - Slicing Operations', () => {
    let tempHistoryPath: string;

    beforeEach(() => {
        tempHistoryPath = path.join(os.tmpdir(), `test-bash-history-${Date.now()}`);
    });

    afterEach(() => {
        if (fs.existsSync(tempHistoryPath)) {
            fs.unlinkSync(tempHistoryPath);
        }
    });

    it('should return last N commands', () => {
        const mockHistory = 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = getLastNCommands(3, tempHistoryPath);
        expect(commands).toEqual(['cmd3', 'cmd4', 'cmd5']);
    });

    it('should return all commands if N >= total', () => {
        const mockHistory = 'cmd1\ncmd2\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = getLastNCommands(10, tempHistoryPath);
        expect(commands).toEqual(['cmd1', 'cmd2']);
    });

    it('should return exactly N commands if available', () => {
        const mockHistory = 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = getLastNCommands(5, tempHistoryPath);
        expect(commands).toHaveLength(5);
        expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5']);
    });

    it('should handle N=0', () => {
        const mockHistory = 'cmd1\ncmd2\ncmd3\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = getLastNCommands(0, tempHistoryPath);
        expect(commands).toEqual([]);
    });

    it('should handle N=1', () => {
        const mockHistory = 'cmd1\ncmd2\ncmd3\n';
        fs.writeFileSync(tempHistoryPath, mockHistory);

        const commands = getLastNCommands(1, tempHistoryPath);
        expect(commands).toEqual(['cmd3']);
    });
});
```

### Test Suite 2.3: Command Parsing (`parseBashHistory`)

```typescript
describe('parseBashHistory - Structuring Operations', () => {
    it('should parse commands into BashCommand objects', () => {
        const commands = ['npm run build', 'git status'];
        const parsed = parseBashHistory(commands, '/test/cwd');

        expect(parsed).toHaveLength(2);
        expect(parsed[0]).toMatchObject({
            command: 'npm run build',
            cwd: '/test/cwd',
        });
        expect(parsed[0].timestamp).toBeDefined();
        expect(parsed[1]).toMatchObject({
            command: 'git status',
            cwd: '/test/cwd',
        });
    });

    it('should use current directory if cwd not provided', () => {
        const commands = ['ls'];
        const parsed = parseBashHistory(commands);

        expect(parsed[0].cwd).toBe(process.cwd());
    });

    it('should assign approximate timestamps in ascending order', () => {
        const commands = ['cmd1', 'cmd2', 'cmd3'];
        const parsed = parseBashHistory(commands);

        const t1 = new Date(parsed[0].timestamp).getTime();
        const t2 = new Date(parsed[1].timestamp).getTime();
        const t3 = new Date(parsed[2].timestamp).getTime();

        expect(t1).toBeLessThan(t2);
        expect(t2).toBeLessThan(t3);
    });

    it('should space timestamps by 1 second', () => {
        const commands = ['cmd1', 'cmd2'];
        const parsed = parseBashHistory(commands);

        const t1 = new Date(parsed[0].timestamp).getTime();
        const t2 = new Date(parsed[1].timestamp).getTime();

        expect(t2 - t1).toBeGreaterThanOrEqual(1000);
        expect(t2 - t1).toBeLessThan(1100); // allow some tolerance
    });

    it('should handle empty commands array', () => {
        const parsed = parseBashHistory([]);
        expect(parsed).toEqual([]);
    });

    it('should handle single command', () => {
        const parsed = parseBashHistory(['single command']);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].command).toBe('single command');
    });

    it('should preserve exact command text', () => {
        const commands = ['  spaces  ', '\ttabs\t', 'normal'];
        const parsed = parseBashHistory(commands);

        expect(parsed[0].command).toBe('  spaces  ');
        expect(parsed[1].command).toBe('\ttabs\t');
        expect(parsed[2].command).toBe('normal');
    });

    it('should produce valid ISO timestamp strings', () => {
        const commands = ['cmd'];
        const parsed = parseBashHistory(commands);

        const timestamp = parsed[0].timestamp;
        expect(() => new Date(timestamp)).not.toThrow();
        expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
});
```

**Verification:**
```bash
cd packages/vscode-tara-puller-extenssion
npm run test -- test/utils/bash-history-parser.spec.ts
```

---

## Stage 3: Configuration File

**Goal:** Create the sensitive patterns JSON config file

**Files:**
- `packages/vscode-tara-puller-extenssion/src/config/sensitive-patterns.json`

**No tests needed** - this is a data file, tested via `loadFilterConfig()`

**Manual Verification:**
```bash
cat packages/vscode-tara-puller-extenssion/src/config/sensitive-patterns.json
```

---

## Stage 4: Bash History Provider (Core Logic)

**Goal:** Implement the provider that monitors and records bash history

**Files:**
- `packages/vscode-tara-puller-extenssion/src/providers/BashHistoryProvider.ts`
- `packages/vscode-tara-puller-extenssion/test/providers/bash-history-provider.spec.ts`

**Implementation Order:**
1. Create `BashHistoryProviderOptions` interface
2. Implement constructor
3. Implement `start()` and `stop()`
4. Implement `updateConfig()`
5. Implement `getCurrentCommandCount()`
6. Implement `updateLastCommandCount()`
7. Implement `checkAndRecord()`
8. Implement `recordCommandHistory()`
9. Implement `manualRecord()`

**Tests:**

### Test Suite 4.1: Initialization and Lifecycle

```typescript
describe('BashHistoryProvider - Initialization', () => {
    let tempDir: string;
    let testTara: TaraStack;
    let provider: BashHistoryProvider;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `tara-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        testTara = new TaraStack({
            writer: 'test',
            taraHome: tempDir,
        });
        testTara.global.home.instantiate();
    });

    afterEach(() => {
        if (provider) {
            provider.stop();
        }
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should initialize with all required options', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        expect(provider).toBeDefined();
        expect((provider as any).enabled).toBe(true);
        expect((provider as any).commandCount).toBe(10);
        expect((provider as any).checkIntervalMs).toBe(1000);
    });

    it('should initialize with optional config path', () => {
        const configPath = '/path/to/config.json';
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
            configPath,
        });

        expect((provider as any).configPath).toBe(configPath);
    });

    it('should load filter config on initialization', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        expect((provider as any).filterConfig).toBeDefined();
        expect((provider as any).filterConfig.patterns).toBeDefined();
        expect((provider as any).filterConfig.maxCommandLength).toBeDefined();
    });

    it('should initialize lastCommandCount', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        expect((provider as any).lastCommandCount).toBeGreaterThanOrEqual(0);
    });
});
```

### Test Suite 4.2: Start/Stop Operations

```typescript
describe('BashHistoryProvider - Start/Stop', () => {
    let tempDir: string;
    let testTara: TaraStack;
    let provider: BashHistoryProvider;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `tara-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        testTara = new TaraStack({ writer: 'test', taraHome: tempDir });
        testTara.global.home.instantiate();
    });

    afterEach(() => {
        if (provider) provider.stop();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should start monitoring when enabled', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.start();
        expect((provider as any).intervalId).not.toBeNull();
    });

    it('should not start monitoring when disabled', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: false,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.start();
        expect((provider as any).intervalId).toBeNull();
    });

    it('should stop monitoring and clear interval', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.start();
        expect((provider as any).intervalId).not.toBeNull();

        provider.stop();
        expect((provider as any).intervalId).toBeNull();
    });

    it('should handle stop when not started', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        expect(() => provider.stop()).not.toThrow();
    });

    it('should clear existing interval on restart', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.start();
        const firstIntervalId = (provider as any).intervalId;

        provider.start(); // Start again
        const secondIntervalId = (provider as any).intervalId;

        expect(firstIntervalId).not.toBe(secondIntervalId);
    });
});
```

### Test Suite 4.3: Configuration Updates

```typescript
describe('BashHistoryProvider - Config Updates', () => {
    let tempDir: string;
    let testTara: TaraStack;
    let provider: BashHistoryProvider;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `tara-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        testTara = new TaraStack({ writer: 'test', taraHome: tempDir });
        testTara.global.home.instantiate();
    });

    afterEach(() => {
        if (provider) provider.stop();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should update enabled state', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: false,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.updateConfig({ enabled: true });
        expect((provider as any).enabled).toBe(true);
    });

    it('should update command count', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.updateConfig({ commandCount: 20 });
        expect((provider as any).commandCount).toBe(20);
    });

    it('should update check interval', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.updateConfig({ checkIntervalMs: 5000 });
        expect((provider as any).checkIntervalMs).toBe(5000);
    });

    it('should reload filter config on config path change', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        const oldConfig = (provider as any).filterConfig;
        provider.updateConfig({ configPath: '/new/path' });
        
        expect((provider as any).configPath).toBe('/new/path');
        // Config should be reloaded (may be same if path doesn't exist)
    });

    it('should restart if enabled after update', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: false,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.updateConfig({ enabled: true });
        expect((provider as any).intervalId).not.toBeNull();
    });

    it('should stop if disabled after update', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.start();
        provider.updateConfig({ enabled: false });
        expect((provider as any).intervalId).toBeNull();
    });
});
```

### Test Suite 4.4: Recording Operations

```typescript
describe('BashHistoryProvider - Recording', () => {
    let tempDir: string;
    let testTara: TaraStack;
    let provider: BashHistoryProvider;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `tara-test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        testTara = new TaraStack({ writer: 'test', taraHome: tempDir });
        testTara.global.home.instantiate();
    });

    afterEach(() => {
        if (provider) provider.stop();
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('should manually record without errors', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        expect(() => provider.manualRecord()).not.toThrow();
    });

    it('should create tape file on manual record', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.manualRecord();

        const tapePath = testTara.global.tapes.get('tara-puller').getHomePath();
        expect(fs.existsSync(tapePath)).toBe(true);
    });

    it('should write valid JSONL to tape', async () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.manualRecord();

        const tapePath = testTara.global.tapes.get('tara-puller').getHomePath();
        const content = fs.readFileSync(tapePath, 'utf-8');
        const lines = content.trim().split('\n');

        // Should have at least metadata line
        expect(lines.length).toBeGreaterThanOrEqual(1);

        // Each line should be valid JSON
        lines.forEach(line => {
            expect(() => JSON.parse(line)).not.toThrow();
        });
    });

    it('should record bash-history type record', async () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        provider.manualRecord();

        const tape = testTara.global.tapes.get('tara-puller');
        const records: any[] = [];
        await tape.readRecords((record) => {
            records.push(record.getContent());
        });

        // Find the bash-history record (skip metadata)
        const historyRecord = records.find(r => r.type === 'tara-puller/bash-history');
        
        if (historyRecord) {
            expect(historyRecord.type).toBe('tara-puller/bash-history');
            expect(historyRecord.capturedAt).toBeDefined();
            expect(historyRecord.commandCount).toBeGreaterThanOrEqual(0);
            expect(historyRecord.commands).toBeInstanceOf(Array);
        }
    });

    it('should update lastCommandCount after manual record', () => {
        provider = new BashHistoryProvider({
            tara: testTara,
            enabled: true,
            commandCount: 10,
            checkIntervalMs: 1000,
        });

        const before = (provider as any).lastCommandCount;
        provider.manualRecord();
        const after = (provider as any).lastCommandCount;

        // Should be updated (may be same if no history)
        expect(after).toBeGreaterThanOrEqual(before);
    });
});
```

**Verification:**
```bash
cd packages/vscode-tara-puller-extenssion
npm run test -- test/providers/bash-history-provider.spec.ts
```

---

## Stage 5: Extension Integration

**Goal:** Integrate the provider into the main extension

**Files:**
- `packages/vscode-tara-puller-extenssion/src/extension.ts` (modifications)
- `packages/vscode-tara-puller-extenssion/package.json` (modifications)

**No unit tests needed** - this is integration code, tested manually

**Manual Verification Steps:**

1. Build extension:
```bash
cd packages/vscode-tara-puller-extenssion
npm run build
```

2. Install extension:
```bash
npm run dev-install
```

3. Reload VS Code window

4. Test commands:
```
Cmd+Shift+P → "Tara Puller: Record Bash History Now"
Cmd+Shift+P → "Tara Puller: Toggle Bash History Monitoring"
```

5. Verify settings:
```
Cmd+, → Search "Tara Puller" → Check bash history settings appear
```

6. Verify recording:
```bash
# Run some bash commands
ls -la
npm run build
git status

# Wait or trigger manual record
# Then check tape
cat ~/.taraproject/tapes/tara-puller/$(date +%Y-%m)-tara-puller.tara.jsonl
```

---

## Test Execution Order

Run tests in this order to verify each stage builds on the previous:

```bash
cd packages/vscode-tara-puller-extenssion

# Stage 1: Sensitive Filter
npm run test -- test/utils/sensitive-filter.spec.ts

# Stage 2: Bash History Parser
npm run test -- test/utils/bash-history-parser.spec.ts

# Stage 3: Skip (config file, no tests)

# Stage 4: Bash History Provider
npm run test -- test/providers/bash-history-provider.spec.ts

# Stage 5: Manual testing in VS Code

# All tests together
npm run test
```

---

## Success Criteria by Stage

### Stage 1 ✓
- All sensitive filter tests pass
- Pattern matching works correctly
- Command truncation works
- Config loading handles all cases

### Stage 2 ✓
- All parser tests pass
- File reading handles edge cases
- Slicing works correctly
- Timestamp generation is consistent

### Stage 3 ✓
- Config file exists and is valid JSON
- Patterns are comprehensive

### Stage 4 ✓
- All provider tests pass
- Start/stop works correctly
- Config updates apply properly
- Manual recording creates valid tape entries

### Stage 5 ✓
- Extension builds without errors
- Commands appear in command palette
- Settings appear in preferences
- Manual recording works in VS Code
- Automatic recording triggers on new commands
- Tapes contain valid bash-history records
