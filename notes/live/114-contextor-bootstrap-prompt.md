## Contextor

Contextor is a central service whose goal is to let applications attach meaningful, minimal, and expandable context to their data without owning or managing the full lifecycle of that context themselves; it acts as the single place an app goes to request situational state, orchestrates a set of built-in context providers to capture that state at a specific moment, persists any richer context data it decides to manage (for example in context tapes or storage backends), and returns to the app a sparse, stable result containing execution status and lightweight context anchors. The core design pattern is request–orchestrate–reference: the app declares intent through provider requests, Contextor executes providers in a controlled environment with isolation and failure tolerance, and the app only attaches the resulting anchors and minimal fragments to its own records, while the heavy, connected context data remains owned, evolvable, and expandable by Contextor itself.

## Core Concepts

**Contextor** – central service that receives provider requests, orchestrates their execution, and returns provider request results.

**ContextProvider** 
– abstract class or interface implemented by each provider to collect and optionally persist one slice of context.
- Contextor provides a set of ContextProviders out of the box

**ProviderRegistry** – internal map that registers provider names to provider instances and resolves them during collection.

**ContextRequest** – user-facing request object that declares which provider to run and with which parameters.

**ContextRequestResult** – structured result returned by a provider containing execution status, minimal inline fragment, and context anchors.

**ContextAnchor** – small, typed reference object that points to context material stored elsewhere and can be attached to subject data.

**ContextExecutionEnv** – shared environment object passed to providers containing settings, working directory, time budget, and storage handles.

**ContextCollector** – internal helper that executes a single provider request with timeout handling and error normalization.

**ContextSessionId** – lightweight identifier representing one context collection moment shared across provider executions.

**ContextTapeWriter** – optional service responsible for writing context records to a dedicated context tape.

**ContextRecord** – append-only data structure representing one provider’s collected context stored by the Contextor.

**AnchorFactory** – utility responsible for constructing ContextAnchor objects from stored context artifacts or records.

**ContextResultAssembler** – component that aggregates all ProviderRequestResults into the final response returned to the app.

**ContextErrorReport** – normalized error object used when a provider fails but context collection continues.

**ContextConfig** – configuration object controlling enabled providers, default modes, and capture constraints.


## Minimlum Viable Implementation
- Bootstrap Contextor so we can get context for a current vscode session.
- context will include
    - opened files
    - focused file
    - workspace folders


## MVP script

- A MVP would execute an script similar to this:
    - do not take the script totally literally, but the core structure is relevant.

```typescript
import { Contextor } from 'tara-contextor';

async function main() {
    const contextor = new Contextor({
        captureTimeoutMs: 3000,
    });

    let providerRequests: ContextRequest[];
    providerRequests = [
        { 
            provider: 'vscode-session', 
            items: 
            [
                'opened-files-paths',
                'focused-file-paths',
                'workspace-folders-paths'
            ], 
            options: {}
        }
    ];

    let contextResults: ContextRequestResult[]
    contextResults = await contextor.collect(providerRequests);

    console.log('Collected Context:', contextResults);
}   

main().catch(err => {
    console.error('Error during context collection:', err);
});
```