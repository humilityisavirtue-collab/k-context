<script lang="ts">
  let copied = $state(false);

  function copyCommand() {
    navigator.clipboard.writeText('npx k-context init');
    copied = true;
    setTimeout(() => copied = false, 2000);
  }
</script>

<svelte:head>
  <title>k-context - AI Context for Your Codebase</title>
  <meta name="description" content="Generate CLAUDE.md and Cursor rules from any codebase. Make AI assistants actually understand your project." />
</svelte:head>

<div class="min-h-screen bg-[var(--bg-primary)]">
  <!-- Hero -->
  <header class="px-6 py-20 text-center max-w-4xl mx-auto">
    <h1 class="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
      k-context
    </h1>
    <p class="text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
      Generate CLAUDE.md and Cursor rules from any codebase.
      Make AI assistants <span class="text-[var(--text-primary)]">actually understand</span> your project.
    </p>

    <!-- Install command -->
    <div class="flex justify-center mb-8">
      <button
        onclick={copyCommand}
        class="flex items-center gap-3 bg-[var(--bg-secondary)] border border-zinc-800 rounded-lg px-6 py-3 font-mono text-sm hover:border-zinc-700 transition-colors"
      >
        <span class="text-[var(--text-secondary)]">$</span>
        <span>npx k-context init</span>
        <span class="text-[var(--text-secondary)] ml-2">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>
    </div>

    <div class="flex justify-center gap-4">
      <a
        href="#pricing"
        class="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg font-medium transition-colors"
      >
        Get Started Free
      </a>
      <a
        href="https://github.com/humilityisavirtue-collab/k-context"
        target="_blank"
        rel="noopener noreferrer"
        class="px-6 py-3 border border-zinc-700 hover:border-zinc-600 rounded-lg font-medium transition-colors"
      >
        View on GitHub
      </a>
    </div>
  </header>

  <!-- Features -->
  <section class="px-6 py-16 max-w-6xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-12">Why k-context?</h2>

    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-zinc-800">
        <div class="text-3xl mb-4">🎯</div>
        <h3 class="text-xl font-semibold mb-2">Semantic Understanding</h3>
        <p class="text-[var(--text-secondary)]">
          K-routing classifies files by domain (UI, logic, data, actions) so AI assistants understand your architecture.
        </p>
      </div>

      <div class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-zinc-800">
        <div class="text-3xl mb-4">⚡</div>
        <h3 class="text-xl font-semibold mb-2">Instant Setup</h3>
        <p class="text-[var(--text-secondary)]">
          One command. Works with any codebase. Generates CLAUDE.md and Cursor rules in seconds.
        </p>
      </div>

      <div class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-zinc-800">
        <div class="text-3xl mb-4">🔒</div>
        <h3 class="text-xl font-semibold mb-2">Local-First</h3>
        <p class="text-[var(--text-secondary)]">
          Your code stays on your machine. Free tier works entirely offline. No cloud required.
        </p>
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section class="px-6 py-16 bg-[var(--bg-secondary)]">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">How it works</h2>

      <div class="space-y-8">
        <div class="flex gap-6 items-start">
          <div class="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 font-bold">1</div>
          <div>
            <h3 class="text-xl font-semibold mb-2">Scan your codebase</h3>
            <p class="text-[var(--text-secondary)]">k-context analyzes your project structure, detects frameworks, and extracts patterns from your code.</p>
          </div>
        </div>

        <div class="flex gap-6 items-start">
          <div class="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 font-bold">2</div>
          <div>
            <h3 class="text-xl font-semibold mb-2">Generate context files</h3>
            <p class="text-[var(--text-secondary)]">Creates CLAUDE.md for Claude Code and .cursor/rules/ for Cursor with your project's architecture, commands, and conventions.</p>
          </div>
        </div>

        <div class="flex gap-6 items-start">
          <div class="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 font-bold">3</div>
          <div>
            <h3 class="text-xl font-semibold mb-2">Better AI responses</h3>
            <p class="text-[var(--text-secondary)]">AI assistants now understand your project structure and can give more accurate, context-aware suggestions.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing" class="px-6 py-16 max-w-5xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
    <p class="text-center text-[var(--text-secondary)] mb-12">Start free, upgrade when you need more.</p>

    <div class="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
      <!-- Free -->
      <div class="bg-[var(--bg-secondary)] rounded-xl p-8 border border-zinc-800">
        <h3 class="text-2xl font-bold mb-2">Free</h3>
        <p class="text-4xl font-bold mb-6">$0<span class="text-lg text-[var(--text-secondary)] font-normal">/month</span></p>
        <ul class="space-y-3 mb-8 text-[var(--text-secondary)]">
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> Up to 100 files
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> 1 project
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> CLAUDE.md generation
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> Cursor rules generation
          </li>
          <li class="flex items-center gap-2">
            <span class="text-zinc-600">✗</span> Cloud sync
          </li>
        </ul>
        <button class="w-full py-3 border border-zinc-700 hover:border-zinc-600 rounded-lg font-medium transition-colors">
          Get Started
        </button>
      </div>

      <!-- Pro -->
      <div class="bg-[var(--bg-secondary)] rounded-xl p-8 border-2 border-blue-500 relative">
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-sm px-3 py-1 rounded-full">
          Popular
        </div>
        <h3 class="text-2xl font-bold mb-2">Pro</h3>
        <p class="text-4xl font-bold mb-6">$19<span class="text-lg text-[var(--text-secondary)] font-normal">/month</span></p>
        <ul class="space-y-3 mb-8 text-[var(--text-secondary)]">
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> Unlimited files
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> 5 projects
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> CLAUDE.md generation
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> Cursor rules generation
          </li>
          <li class="flex items-center gap-2">
            <span class="text-green-400">✓</span> Cloud sync + learning
          </li>
        </ul>
        <a
          href="https://buy.stripe.com/3cIaEQaJ0eNz8Qu2ztcQU00"
          class="block w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg font-medium transition-colors text-center"
        >
          Upgrade to Pro
        </a>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="px-6 py-20 text-center">
    <h2 class="text-3xl font-bold mb-4">Ready to supercharge your AI workflow?</h2>
    <p class="text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
      Start generating context files for your projects in seconds.
    </p>
    <button
      onclick={copyCommand}
      class="flex items-center gap-3 bg-[var(--bg-secondary)] border border-zinc-800 rounded-lg px-6 py-3 font-mono text-sm hover:border-zinc-700 transition-colors mx-auto"
    >
      <span class="text-[var(--text-secondary)]">$</span>
      <span>npx k-context init</span>
    </button>
  </section>

  <!-- Footer -->
  <footer class="px-6 py-8 border-t border-zinc-800 text-center text-[var(--text-secondary)] text-sm">
    <p>&copy; 2025 k-context. MIT License.</p>
  </footer>
</div>
