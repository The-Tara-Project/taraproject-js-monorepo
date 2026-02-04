# Tara Puller - VSCode Extension

## Overview

**Tara Puller** is a VS Code extension that periodically prompts you to describe what you're doing/thinking and automatically records your responses along with rich context information to a Tara tape. It's designed to help developers maintain an ongoing personal log of their activities, thoughts, and work context without manual effort.

The extension operates on a configurable interval, captures contextual information about your workspace, and stores everything in an append-only JSONL format compatible with the Tara ecosystem.

## Key Features

- **Periodic Prompting**: Configurable interval-based prompts (default: 60 seconds)
- **Rich Context Capture**: Records opened files, focused file, and workspace folders
- **Custom Questions**: Load questions from JSON files or use default prompt
- **Flexible Input**: Submit responses ending with `...` or dismiss explicitly
- **Window Focus Awareness**: Only prompts when VS Code window is focused
- **Test Mode**: Isolated test environment for development
- **Automatic Recording**: Stores everything to Tara tape format automatically
- **Retry Logic**: Reschedules prompts if user dismisses dialogs
- **Configuration API**: Change frequency, enable/disable, toggle test mode on the fly

## Architecture

### Package Structure

```
src/
└── extension.ts  # Complete extension implementation (584 lines)
    - Question management (loading, saving, defaults)
    - Puller state management
    - Dialog and UI logic
    - Tape recording
    - Command registration
    - Checker loop and timing
```

Unlike the Tara Reader extension which is modularized, Tara Puller is implemented as a single comprehensive file to maintain all state in one place and manage the complex timing and dialog logic.

### Main Components & State Management

#### 1. **PullerState Interface**

Central state management object tracking all extension state:

```typescript
interface PullerState {
  lastPromptTime: number;      // Timestamp of last prompt
  isWindowFocused: boolean;    // Window focus state
  intervalId: NodeJS.Timeout | null;    // Main checker loop
  retryTimeoutId: NodeJS.Timeout | null; // Retry timer
  tara: TaraStack | null;              // Current active stack
  user_tara: TaraStack | null;         // Production stack
  dev_tara: TaraStack | null;          // Test stack
  contextor: Contextor | null;         // Context collector
  minIntervalMs: number;               // Min milliseconds between prompts
  checkIntervalMs: number;             // Check frequency in ms
  enabled: boolean;                    // Enable/disable flag
  testMode: boolean;                   // Use test or production data
  isDialogShowing: boolean;            // Dialog overlap prevention
}
```

**Key Properties:**
- Dual TaraStack instances: one for production, one for testing
- Dialog locking flag to prevent race conditions
- Separate timing for minimum interval and check frequency
- Contextor integration for collecting workspace context

#### 2. **Question Management**

Questions are stored as JSON files in `~/.taraproject/apps/tara-puller/questions/`

**Question File Format:**
```json
{
  "question": "What are you doing/thinking?",
  "prompt": "Describe your current activity (end with ... to submit, or type just ... to dismiss)",
  "placeholder": "e.g., Working on feature X...",
  "pullerName": "tara-puller"
}
```

**Functions:**
- `getQuestionsPath(tara)`: Locates questions directory
- `ensureQuestionsFolder(tara)`: Creates directory if missing
- `listQuestionFiles(tara)`: Lists available question IDs
- `saveQuestion(tara, questionId, question)`: Persists question to file
- `loadRandomQuestion(tara)`: Picks random question or returns null
- `loadQuestionForDialog()`: Loads question with fallback to default
- `defaultQuestion()`: Returns built-in question

#### 3. **Configuration Management**

Settings stored in VS Code configuration under `taraPuller` scope:

```typescript
taraPuller.minInterval      // Min seconds between prompts (default: 60)
taraPuller.checkInterval    // Check frequency in seconds (default: 10)
taraPuller.enabled          // Enable/disable automatic prompts (default: true)
taraPuller.testMode         // Use test stack (default: false)
```

**Functions:**
- `getConfig<T>(key, defaultValue)`: Read from workspace config
- `setConfig(key, value)`: Write to workspace config
- `loadSettings()`: Load all settings into state with validation
- Validation enforces minimums and prevents invalid combinations

#### 4. **TaraStack Initialization**

Manages dual-stack pattern for production and testing:

```typescript
function initTaraStack(): TaraStack {
  if (!state.tara) {
    // Create both stacks
    state.user_tara = new TaraStack({ writer: APP_NAME });
    state.dev_tara = new TaraStack({
      writer: APP_NAME,
      taraHome: state.user_tara.global.home.getDevPath('tara-puller-test-stack')
    });
    
    // Select based on testMode
    state.tara = state.testMode ? state.dev_tara : state.user_tara;
    state.tara.global.home.instantiate();
    
    // Initialize Contextor
    state.contextor = new Contextor(state.tara);
  }
  return state.tara;
}
```

**Key Pattern:** Stacks only initialized once (singleton); `reinitTaraStack()` swaps mode without recreating.

#### 5. **Context Collection**

Integrates with Tara Contextor to capture workspace state:

```typescript
async function collectContext(): Promise<ContextRequestResult[]> {
  if (!state.contextor) return [];
  
  return state.contextor.collect([{
    provider: 'vscode-session',
    items: ['opened-files-paths', 'focused-file-path', 'workspace-folders-paths'],
    options: { vscode }
  }]);
}
```

**Captured Data:**
- List of all opened files
- Currently focused file
- All workspace folder paths
- Timestamp of capture

#### 6. **Prompt Dialog & Input Validation**

`showPullDialog()` function orchestrates the complete dialog flow:

**Input Validation Rules:**
- Accept: Just `...` to dismiss explicitly
- Accept: Any text ending with `...` to submit
- Reject: Empty input or text not ending with `...`

**Dialog Outcomes:**
1. **User submits** (`text...`): Strip suffix, record response
2. **User dismisses** (just `...`): Record as dismissed (null response)
3. **User cancels** (ESC/click-out): Schedule retry after 5s
4. **Validation fails**: Show validation message

**Dialog Code:**
```typescript
const response = await vscode.window.showInputBox({
  title: question.question,
  prompt: question.prompt,
  placeHolder: question.placeholder,
  validateInput: (value: string) => {
    if (value === CONFIRM_PREFIX) return null;  // Just "..." - OK
    if (value.endsWith(CONFIRM_PREFIX)) return null;  // "text..." - OK
    if (value.length === 0) return 'Type ... to dismiss...';
    return 'End message with ... to submit, or type just ... to dismiss';
  }
});
```

#### 7. **Tape Recording**

Records entry to current tape with full context:

```typescript
async function recordEntry(
  response: string | null,
  dismissed: boolean,
  contextResults: ContextRequestResult[]
): Promise<void> {
  const tape = getTape();
  const record = new RecordHandler({
    content: {
      type: 'tara-puller/entry',
      timestamp: new Date().toISOString(),
      dismissed,
      response,
      contextResults,
    }
  });
  tape.appendRecord(record);
}
```

**Recorded Structure:**
```json
{
  "type": "tara-puller/entry",
  "timestamp": "2026-02-04T10:30:45.123Z",
  "dismissed": false,
  "response": "Implementing user authentication feature",
  "contextResults": [
    {
      "provider": "vscode-session",
      "status": "success",
      "collectedItems": ["opened-files-paths", "focused-file-path", ...],
      "liteContext": {
        "opened-files-paths": [...],
        "focused-file-path": "...",
        "workspace-folders-paths": [...]
      }
    }
  ]
}
```

#### 8. **Checker Loop**

Background loop checking if conditions are met to show prompt:

```typescript
function startChecker(): void {
  state.intervalId = setInterval(() => {
    if (shouldShowPrompt()) {
      showPullDialog();
    }
  }, state.checkIntervalMs);
}

function shouldShowPrompt(): boolean {
  return (
    isEnabled() &&           // Not disabled
    isUserActive() &&        // Window is focused
    isTimeToQuery() &&       // Minimum interval elapsed
    !state.isDialogShowing   // Not already showing
  );
}
```

**Timing Logic:**
- Checks run every `checkInterval` milliseconds (default: 10s)
- Prompt only shows if `minInterval` has elapsed (default: 60s)
- Window focus state tracked via `onDidChangeWindowState`
- Dialog locking prevents overlapping dialogs

#### 9. **Retry Mechanism**

Handles user dismissals gracefully:

```typescript
function scheduleRetry(): void {
  if (state.retryTimeoutId) clearTimeout(state.retryTimeoutId);
  
  state.retryTimeoutId = setTimeout(() => {
    state.retryTimeoutId = null;
    if (isEnabled() && isUserActive() && !state.isDialogShowing) {
      showPullDialog();
    }
  }, 5000);  // Retry after 5 seconds
}
```

**When Retry Scheduled:**
- User dismisses dialog (hits ESC, clicks outside)
- User presses Cancel/Back

**When Retry NOT Scheduled:**
- User explicitly dismisses (types `...`)
- User submits response
- Retry timeout cleared before showing new dialog

#### 10. **Commands**

Five commands registered and accessible via command palette:

1. **`taraPuller.askNow`**
   - Immediately show prompt regardless of timing
   - Usage: `Cmd+Shift+P` → "Tara Puller: Ask Now"

2. **`taraPuller.showStatus`**
   - Display current configuration and state
   - Shows enabled/disabled, test mode, timing info
   - Shows time until next scheduled prompt

3. **`taraPuller.setFrequency`**
   - Input dialog to change `minInterval`
   - Validates input >= 10 seconds
   - Updates global VS Code settings

4. **`taraPuller.toggleEnabled`**
   - Toggle enable/disable state
   - Restarts checker if toggled to enabled
   - Stops checker if toggled to disabled

5. **`taraPuller.toggleTestMode`**
   - Switch between production and test stacks
   - Reinitializes TaraStack
   - Shows which path is now active

## Data Flow

```
Extension Activation
    ↓
Load settings from VS Code config
    ↓
Initialize TaraStack (production or test)
    ↓
Register all commands
    ↓
Start checker loop (if enabled)
    ↓
Check every 10s: Is enough time passed AND window focused?
    ↓ Yes
Show input dialog with question
    ↓
User enters response or dismisses
    ↓
Collect context (files, workspace)
    ↓
Record to tape:
  - Timestamp
  - Response (or null if dismissed)
  - Context info
    ↓
Update lastPromptTime
    ↓
Return to checker loop
```

## Configuration

### VS Code Settings

Located in `.vscode/settings.json` or user settings:

```json
{
  "taraPuller.minInterval": 60,      // Seconds between prompts
  "taraPuller.checkInterval": 10,    // Seconds between checks
  "taraPuller.enabled": true,        // Auto-prompt enabled
  "taraPuller.testMode": false       // Use test stack
}
```

### Validation Rules

- `minInterval` must be >= 10 seconds (enforced)
- `checkInterval` must be < `minInterval` (auto-adjusted)
- `checkInterval` must be >= 1 second
- Both converted to milliseconds internally

### Data Directories

**Production:**
```
~/.taraproject/
├── apps/tara-puller/
│   ├── questions/          # Custom question JSON files
│   └── tapes/             # Monthly tape files
```

**Test Mode:**
```
~/.taraproject/dev/tara-puller-test-stack/
├── apps/tara-puller/
│   ├── questions/
│   └── tapes/
```

## Recording Format

Each tape is JSONL with:
- **First record**: Metadata (id, name, format, writer, created time)
- **Subsequent records**: Puller entries

**Tape Naming:** `YYYY-MM-tara-puller.tara.jsonl`
- Monthly rotation built into TaraStack
- Example: `2026-02-tara-puller.tara.jsonl`

## Dependencies

- **@jose_pereiro/taralib-js**: Tape reading/writing, TaraStack
- **@jose_pereiro/tara-contextor-ts**: Context collection from workspace
- **@types/vscode**: VS Code extension API
- **@types/node**: Node.js standard library
- **esbuild**: Production bundling
- **typescript**: Language and type checking

## Error Handling

- **TaraStack init failure**: Shows error, extension becomes non-functional
- **Question load failure**: Falls back to default question
- **Context collection failure**: Records empty context, continues
- **Record writing failure**: Logged to console, doesn't block UI
- **Configuration update failure**: Shown as warning

## Performance Considerations

- **Singleton Pattern**: TaraStack initialized once per session
- **Efficient Checking**: 10s check interval reduces CPU usage
- **Event-Based**: Window focus tracked via VSCode events, not polling
- **Lazy Context**: Context only collected when dialog shown
- **Async Recording**: Tape writes don't block UI (non-awaited in original, could be awaited)

## Development

### Build

```bash
npm run build           # Development build with sourcemaps
npm run build:prod     # Production build (minified)
npm run typecheck      # TypeScript type checking
```

### Dev Install

```bash
npm run dev-install    # Builds, packages, and installs extension in VSCode
```

### Testing

1. **Enable test mode**: Run command "Tara Puller: Toggle Test Mode"
2. **Data isolated to**: `~/.taraproject/dev/tara-puller-test-stack/`
3. **Frequency**: Set to 10 seconds for testing: "Tara Puller: Set Frequency"
4. **Manual trigger**: "Tara Puller: Ask Now"

## Integration with Tara Ecosystem

- **TaraStack**: Foundation for tape storage and access
- **TapeHandler**: Creating and appending to tapes
- **RecordHandler**: Structuring recorded entries
- **Contextor**: Collecting workspace context
- **Tara Reader Extension**: View recorded entries

## Future Enhancements

- Analytics dashboard of collected data
- Pattern detection in responses
- Export/analysis tools
- Integration with time tracking
- AI-powered response suggestions
- Response templates
- Batch entry editing
- Offline buffering with sync
- Response search across tapes
- Detailed statistics and insights
