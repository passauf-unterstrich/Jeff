<script lang="ts">
	import './app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>Jeff · Mise</title>
	<meta name="description" content="Dein privater Küchen-Workspace für Rezepte, Einkauf und Vorrat." />
	<meta name="robots" content="noindex,nofollow" />
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

{@render children()}
