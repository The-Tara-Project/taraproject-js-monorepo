# Bootstrapping Invariants

- **Bootstrap values are resolved first**: 
    - for instance, `taraHome` and `workingDir` are determined from options → env vars → defaults before any manager initialization
- **No cross-manager dependencies during construction**: 
    - Managers use only bootstrap values during construction; settings cascade is established after all managers exist
- **Settings refresh is post-construction**: 
    - `settings.refresh()` is called after all managers are instantiated, allowing the cascade to include bootstrap as the fallback source
- **Stack context provides stable access**: All managers receive the `TaraStack` instance, enabling consistent access to bootstrap values and sibling managers