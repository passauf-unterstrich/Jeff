<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowRight, Mail } from 'lucide-svelte';
	import { getSupabase, supabaseConfigured } from '$lib/supabase';

	let email = $state('');
	let password = $state('');
	let mode = $state<'password' | 'magic'>('password');
	let message = $state('');
	let error = $state('');
	let loading = $state(false);
	const configured = supabaseConfigured();

	onMount(async () => {
		if (!configured) return;
		const { data } = await getSupabase().auth.getSession();
		if (data.session) await goto('/');
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		message = '';
		loading = true;
		try {
			const supabase = getSupabase();
			if (mode === 'password') {
				const result = await supabase.auth.signInWithPassword({ email, password });
				if (result.error) throw result.error;
				await goto('/');
			} else {
				const result = await supabase.auth.signInWithOtp({
					email,
					options: { emailRedirectTo: window.location.origin }
				});
				if (result.error) throw result.error;
				message = 'Der Anmeldelink ist unterwegs. Du kannst dieses Fenster offen lassen.';
			}
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Anmeldung fehlgeschlagen.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Jeff · Privater Zugang</title></svelte:head>

<main>
	<section class="login-card">
		<div class="mark">J</div>
		<p class="eyebrow">PRIVATER KÜCHEN-WORKSPACE</p>
		<h1>Willkommen<br />bei Jeff.</h1>
		<p class="intro">Rezepte, Einkauf und Vorrat – ruhig an einem Ort.</p>
		{#if !configured}
			<div class="notice">
				Supabase ist noch nicht verbunden. Die App läuft auf der Startseite im lokalen Demo-Modus.
			</div>
			<a href="/">Demo öffnen <ArrowRight size={17} /></a>
		{:else}
			<div class="modes">
				<button class:active={mode === 'password'} onclick={() => (mode = 'password')}>Passwort</button
				><button class:active={mode === 'magic'} onclick={() => (mode = 'magic')}>Magic Link</button>
			</div>
			<form onsubmit={submit}>
				<label
					>E-Mail<input
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						placeholder="du@beispiel.de"
					/></label
				>
				{#if mode === 'password'}<label
						>Passwort<input
							type="password"
							autocomplete="current-password"
							required
							minlength="6"
							bind:value={password}
						/></label
					>{/if}
				{#if error}<p class="error" role="alert">{error}</p>{/if}{#if message}<p class="success">
						<Mail size={16} />
						{message}
					</p>{/if}
				<button class="submit" disabled={loading}
					>{loading ? 'Einen Moment …' : mode === 'password' ? 'Anmelden' : 'Magic Link senden'}
					<ArrowRight size={17} /></button
				>
			</form>
		{/if}
	</section>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 22px;
		background: radial-gradient(circle at 50% 15%, rgba(217, 230, 207, 0.055), transparent 31%), var(--bg);
	}
	.login-card {
		width: min(100%, 420px);
		padding: 34px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: 0 35px 120px rgba(0, 0, 0, 0.38);
	}
	.mark {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line-strong);
		border-radius: 11px;
		font-weight: 700;
		margin-bottom: 28px;
	}
	.eyebrow {
		color: var(--quiet);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
	}
	h1 {
		font-size: 50px;
		line-height: 0.98;
		letter-spacing: -0.055em;
		font-weight: 540;
		margin: 13px 0;
	}
	.intro {
		color: var(--muted);
		font-size: 15px;
		margin: 0 0 27px;
	}
	.modes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 4px;
		gap: 4px;
		border: 1px solid var(--line);
		border-radius: 12px;
		margin-bottom: 18px;
	}
	.modes button {
		border: 0;
		min-height: 36px;
		border-radius: 8px;
		color: var(--quiet);
		background: transparent;
		cursor: pointer;
	}
	.modes button.active {
		color: var(--text);
		background: var(--surface-3);
	}
	form label {
		display: grid;
		gap: 7px;
		margin-top: 13px;
		color: var(--quiet);
		font-size: 12px;
	}
	input {
		width: 100%;
		min-height: 50px;
		padding: 0 14px;
	}
	.submit,
	a {
		width: 100%;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 20px;
		border: 0;
		border-radius: 11px;
		color: var(--accent-ink);
		background: var(--accent);
		font-weight: 650;
		text-decoration: none;
		cursor: pointer;
	}
	.submit:disabled {
		opacity: 0.5;
	}
	.error,
	.success,
	.notice {
		border-radius: 10px;
		padding: 10px 12px;
		font-size: 11px;
		line-height: 1.5;
	}
	.error {
		color: var(--danger);
		background: rgba(215, 152, 144, 0.07);
	}
	.success {
		color: var(--accent);
		background: rgba(217, 230, 207, 0.06);
		display: flex;
		gap: 8px;
	}
	.notice {
		color: var(--muted);
		background: var(--surface-2);
		border: 1px solid var(--line);
	}
	@media (max-width: 500px) {
		main {
			padding: 13px;
		}
		.login-card {
			padding: 26px 20px;
		}
	}
</style>
