Contextor                    
└── collect(requests) → ContextRequestResult[]
    ├── ProviderRegistry.get(name) → ContextProvider
    └── ContextCollector.execute(provider, request) → result
          └── provider.collect(items, options, env) → ProviderCollectResult  