<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Check,
		ChevronDown,
		ClipboardCheck,
		Edit3,
		Minus,
		Package,
		Plus,
		Search,
		ShoppingBasket,
		Trash2,
		X
	} from 'lucide-svelte';
	import { DemoRepository, SupabaseRepository, type Repository } from '$lib/repository';
	import { getSupabase, supabaseConfigured } from '$lib/supabase';
	import {
		LOCATIONS,
		SHOPPING_CATEGORIES,
		type AppData,
		type InventoryItem,
		type Recipe,
		type ShoppingItem
	} from '$lib/types';

	type Bereich = 'kochen' | 'einkaufen';
	let bereich = $state<Bereich>('kochen');
	let data = $state<AppData | null>(null);
	let repository: Repository;
	let loading = $state(true);
	let error = $state('');
	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let inventoryOpen = $state(false);
	let inventorySearch = $state('');
	let inventoryLocation = $state('Alle Orte');
	let editingInventory = $state<InventoryItem | null>(null);
	let editingShopping = $state<ShoppingItem | null>(null);
	let summaryOpen = $state(false);
	let expandedStepId = $state<string | null>(null);
	let prepCollapsed = $state(false);
	let editingRecipe = $state<Recipe | null>(null);
	let authEmail = $state('');
	const demoMode = !supabaseConfigured();
	const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

	const filteredInventory = $derived(
		(data?.inventory ?? []).filter(
			(item) =>
				item.name.toLowerCase().includes(inventorySearch.trim().toLowerCase()) &&
				(inventoryLocation === 'Alle Orte' || item.location === inventoryLocation)
		)
	);
	const finishedSteps = $derived(data ? Object.values(data.session.stepProgress).filter(Boolean).length : 0);
	const finishedPrep = $derived(data ? Object.values(data.session.prepProgress).filter(Boolean).length : 0);
	const openShoppingCount = $derived(data ? data.shoppingItems.filter((item) => !item.isChecked).length : 0);
	const replenishCount = $derived(
		data
			? data.inventory.filter(
					(item) => item.status === 'wenig' || item.status === 'leer' || item.quantity === 0
				).length
			: 0
	);

	onMount(async () => {
		try {
			if (demoMode) repository = new DemoRepository();
			else {
				const supabase = getSupabase();
				const { data: auth, error: authError } = await supabase.auth.getUser();
				if (authError || !auth.user) {
					await goto('/login');
					return;
				}
				authEmail = auth.user.email ?? '';
				repository = new SupabaseRepository(supabase, auth.user.id);
			}
			data = await repository.load();
		} catch (reason) {
			error = reason instanceof Error ? reason.message : 'Jeff konnte die Daten nicht laden.';
		} finally {
			loading = false;
		}
	});

	onMount(() => {
		const closeOverlay = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			inventoryOpen = false;
			editingInventory = null;
			editingShopping = null;
			editingRecipe = null;
			summaryOpen = false;
		};
		window.addEventListener('keydown', closeOverlay);
		return () => window.removeEventListener('keydown', closeOverlay);
	});

	async function persist(action: () => Promise<void>) {
		saveState = 'saving';
		error = '';
		try {
			await action();
			saveState = 'saved';
			window.setTimeout(() => (saveState = 'idle'), 1300);
		} catch (reason) {
			saveState = 'error';
			error = reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.';
		}
	}
	function togglePrep(id: string) {
		if (!data) return;
		data.session.prepProgress[id] = !data.session.prepProgress[id];
		prepCollapsed = data.recipe.prepItems.every((item) => data!.session.prepProgress[item.id]);
		void persist(() => repository.saveSession(data!.session));
	}
	function toggleStep(id: string) {
		if (!data) return;
		const completed = !data.session.stepProgress[id];
		data.session.stepProgress[id] = completed;
		if (completed) {
			const index = data.recipe.steps.findIndex((step) => step.id === id);
			expandedStepId = data.recipe.steps[index + 1]?.id ?? id;
		} else expandedStepId = id;
		void persist(() => repository.saveSession(data!.session));
	}
	function isCurrentStep(index: number) {
		return (
			!!data &&
			!data.session.stepProgress[data.recipe.steps[index].id] &&
			data.recipe.steps.slice(0, index).every((step) => data!.session.stepProgress[step.id])
		);
	}
	function isExpandedStep(id: string, index: number) {
		return expandedStepId ? expandedStepId === id : isCurrentStep(index);
	}
	function instructionParts(instruction: string) {
		return (
			instruction
				.match(/[^.!?]+[.!?]+|[^.!?]+$/g)
				?.map((part) => part.trim())
				.filter(Boolean) ?? [instruction]
		);
	}
	function finishCooking() {
		if (!data) return;
		data.session.completedAt = data.session.completedAt ? null : new Date().toISOString();
		void persist(() => repository.saveSession(data!.session));
		summaryOpen = true;
	}
	async function saveRecipeEditor() {
		if (!data || !editingRecipe || !editingRecipe.title.trim()) return;
		data.recipe = clone(editingRecipe);
		editingRecipe = null;
		await persist(() => repository.saveRecipe(data!.recipe));
	}
	function newShoppingItem(category: ShoppingItem['category'] = SHOPPING_CATEGORIES[0]) {
		if (!data) return;
		editingShopping = {
			id: crypto.randomUUID(),
			listId: data.shoppingList.id,
			name: '',
			quantity: '',
			note: '',
			category,
			position: data.shoppingItems.length,
			isChecked: false
		};
	}
	async function saveShoppingItem() {
		if (!data || !editingShopping || !editingShopping.name.trim()) return;
		const value = clone(editingShopping);
		const i = data.shoppingItems.findIndex((item) => item.id === value.id);
		if (i >= 0) data.shoppingItems[i] = value;
		else data.shoppingItems.push(value);
		editingShopping = null;
		await persist(() => repository.saveShoppingItem(value));
	}
	async function removeShoppingItem(id: string) {
		if (!data) return;
		data.shoppingItems = data.shoppingItems.filter((item) => item.id !== id);
		editingShopping = null;
		await persist(() => repository.deleteShoppingItem(id));
	}
	function newInventoryItem() {
		editingInventory = {
			id: crypto.randomUUID(),
			name: '',
			trackingType: 'exact',
			quantity: 1,
			unit: 'Stück',
			location: 'Kühlschrank',
			status: 'vorhanden',
			bestBefore: '',
			note: ''
		};
	}
	async function saveInventoryItem() {
		if (!data || !editingInventory || !editingInventory.name.trim()) return;
		const value = clone(editingInventory);
		if (value.trackingType === 'basic') {
			value.quantity = null;
			value.unit = '';
		}
		const i = data.inventory.findIndex((item) => item.id === value.id);
		if (i >= 0) data.inventory[i] = value;
		else data.inventory.push(value);
		editingInventory = null;
		await persist(() => repository.saveInventoryItem(value));
	}
	async function removeInventoryItem(id: string) {
		if (!data) return;
		data.inventory = data.inventory.filter((item) => item.id !== id);
		editingInventory = null;
		await persist(() => repository.deleteInventoryItem(id));
	}
	function decrement(item: InventoryItem) {
		if (item.quantity === null) return;
		const step = item.unit.toLowerCase() === 'g' ? 50 : item.unit.toLowerCase() === 'kg' ? 0.1 : 1;
		item.quantity = Math.max(0, Number((item.quantity - step).toFixed(2)));
		if (item.quantity === 0) item.status = 'leer';
		void persist(() => repository.saveInventoryItem(item));
	}
	function cycleStatus(item: InventoryItem) {
		item.status = item.status === 'vorhanden' ? 'wenig' : item.status === 'wenig' ? 'leer' : 'vorhanden';
		void persist(() => repository.saveInventoryItem(item));
		if (item.status === 'leer') addInventoryToShopping(item);
	}
	function addInventoryToShopping(item: InventoryItem) {
		if (!data) return;
		const existing = data.shoppingItems.find((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
		if (existing) {
			existing.isChecked = false;
			void persist(() => repository.saveShoppingItem(existing));
			return;
		}
		const value: ShoppingItem = {
			id: crypto.randomUUID(),
			listId: data.shoppingList.id,
			name: item.name,
			quantity: item.trackingType === 'exact' ? `1 ${item.unit}`.trim() : '',
			note: 'Aus dem Vorrat',
			category:
				item.location === 'Gefrierfach'
					? 'Tiefkühl'
					: item.location === 'Kühlschrank'
						? 'Kühlregal'
						: 'Brot, Trockenware & Saucen',
			position: data.shoppingItems.length,
			isChecked: false
		};
		data.shoppingItems.push(value);
		void persist(() => repository.saveShoppingItem(value));
	}
	function dueState(item: InventoryItem): 'soon' | 'past' | '' {
		if (!item.bestBefore) return '';
		const days = Math.ceil((new Date(`${item.bestBefore}T12:00:00`).getTime() - Date.now()) / 86400000);
		return days < 0 ? 'past' : days <= 3 ? 'soon' : '';
	}
	async function logout() {
		if (demoMode) return;
		await getSupabase().auth.signOut();
		await goto('/login');
	}
</script>

<svelte:head><title>Jeff · {bereich === 'kochen' ? 'Kochen' : 'Einkaufen'}</title></svelte:head>

<div class="shell">
	<header>
		<a class="brand" href="/" aria-label="Jeff Startseite"><span>J</span><b>Jeff</b></a>
		<nav aria-label="Hauptbereiche">
			<button class:active={bereich === 'kochen'} onclick={() => (bereich = 'kochen')}>Kochen</button><button
				class:active={bereich === 'einkaufen'}
				onclick={() => (bereich = 'einkaufen')}>Einkaufen</button
			>
		</nav>
		<div class="account">
			{#if saveState !== 'idle'}<small class:error={saveState === 'error'}
					>{saveState === 'saving' ? 'Speichert …' : saveState === 'saved' ? 'Gespeichert' : 'Fehler'}</small
				>{/if}<button
				class="avatar"
				onclick={logout}
				aria-label={demoMode ? 'Demo-Modus' : 'Abmelden'}
				title={authEmail || 'Demo-Modus'}>{demoMode ? 'D' : (authEmail[0] ?? 'J').toUpperCase()}</button
			>
		</div>
	</header>
	{#if demoMode}<div class="demo"><span></span> Demo-Modus · Supabase noch nicht verbunden</div>{/if}
	{#if error}<div class="error-banner" role="alert">
			{error}<button onclick={() => (error = '')}><X size={15} /></button>
		</div>{/if}

	{#if loading}<main class="loading" aria-live="polite">
			<div></div>
			<p>Jeff deckt die Arbeitsfläche …</p>
		</main>
	{:else if data}
		{#if bereich === 'kochen'}
			<main class="cook">
				<section class="hero">
					<div class="recipe-meta">
						<input
							aria-label="Kochdatum"
							type="date"
							bind:value={data.recipe.cookDate}
							onblur={() => persist(() => repository.saveRecipe(data!.recipe))}
						/><label
							><input
								aria-label="Portionen"
								type="number"
								min="1"
								max="24"
								bind:value={data.recipe.servings}
								onblur={() => persist(() => repository.saveRecipe(data!.recipe))}
							/> PORTION</label
						>
					</div>
					<textarea
						class="recipe-title"
						rows="1"
						aria-label="Gerichtstitel"
						bind:value={data.recipe.title}
						onblur={() => persist(() => repository.saveRecipe(data!.recipe))}
					></textarea>
					<div class="focus-row">
						<label class="focus"
							>Lernfokus <input
								bind:value={data.recipe.learningFocus}
								onblur={() => persist(() => repository.saveRecipe(data!.recipe))}
							/></label
						>
						<button
							class="recipe-edit"
							aria-label="Rezept bearbeiten"
							onclick={() => (editingRecipe = clone(data!.recipe))}><Edit3 size={15} /> Bearbeiten</button
						>
					</div>
				</section>
				<div class="cook-grid" class:prep-ready={finishedPrep === data.recipe.prepItems.length}>
					<section class="card prep-card" class:collapsed={prepCollapsed}>
						<div class="section-title">
							<ClipboardCheck size={18} />
							<h2>Mise en Place</h2>
							<small
								>{finishedPrep === data.recipe.prepItems.length
									? 'BEREIT'
									: `${finishedPrep}/${data.recipe.prepItems.length}`}</small
							>
							<button
								class="collapse-button"
								class:collapsed={prepCollapsed}
								aria-label={prepCollapsed ? 'Mise en Place ausklappen' : 'Mise en Place einklappen'}
								onclick={() => (prepCollapsed = !prepCollapsed)}><ChevronDown size={17} /></button
							>
						</div>
						{#if !prepCollapsed}<div class="checklist">
								{#each data.recipe.prepItems as item}<label class:done={data.session.prepProgress[item.id]}
										><input
											type="checkbox"
											checked={data.session.prepProgress[item.id] ?? false}
											onchange={() => togglePrep(item.id)}
										/><span class="check"><Check size={15} /></span><span>{item.text}</span></label
									>{/each}
							</div>{/if}
					</section>
					<section class="card steps-card">
						<div class="section-title">
							<h2>Ablauf</h2>
							<small>{finishedSteps}/{data.recipe.steps.length} SCHRITTE</small>
						</div>
						{#each data.recipe.steps as step, i}<article
								class="step"
								class:current={isCurrentStep(i)}
								class:done={data.session.stepProgress[step.id]}
							>
								<button
									class="number"
									aria-label={`${step.title} ${data.session.stepProgress[step.id] ? 'wieder öffnen' : 'erledigen'}`}
									onclick={() => toggleStep(step.id)}
									>{data.session.stepProgress[step.id] ? '✓' : i + 1}</button
								>
								<div class="step-copy">
									<button
										class="step-heading"
										aria-expanded={isExpandedStep(step.id, i)}
										onclick={() => (expandedStepId = isExpandedStep(step.id, i) ? null : step.id)}
										><b>{step.title}</b></button
									>
									<div class="step-facts">
										{#if step.duration}<span>{step.duration}</span>{/if}
										{#if step.temperature}<span>{step.temperature}</span>{/if}
									</div>
								</div>
								<button
									class="expand-button"
									aria-label={`${step.title} ${isExpandedStep(step.id, i) ? 'einklappen' : 'ausklappen'}`}
									onclick={() => (expandedStepId = isExpandedStep(step.id, i) ? null : step.id)}
									><ChevronDown class="step-chevron" size={17} /></button
								>
								{#if isExpandedStep(step.id, i)}
									<div class="instruction">
										{#each instructionParts(step.instruction) as sentence, sentenceIndex}<span
												class="coach-line"><i>{sentenceIndex + 1}</i><span>{sentence}</span></span
											>{/each}
										{#if step.goal}<span class="step-goal"><b>Ziel</b>{step.goal}</span>{/if}
										<button class="complete-step" onclick={() => toggleStep(step.id)}
											><Check size={17} />
											{data.session.stepProgress[step.id] ? 'Wieder öffnen' : 'Schritt erledigt'}</button
										>
									</div>
								{/if}
							</article>{/each}
					</section>
				</div>
				<section class="finish-card card">
					<label for="recipe-note">Notiz für das nächste Mal</label><textarea
						id="recipe-note"
						rows="2"
						placeholder="z. B. nächstes Mal mehr Limette"
						bind:value={data.note.content}
					></textarea>
					<div>
						<button class="quiet-button" onclick={() => persist(() => repository.saveNote(data!.note))}
							>Notiz speichern</button
						><button class="primary" onclick={finishCooking}
							>{data.session.completedAt ? 'Abschluss zurücknehmen' : 'Kochen abschließen'}
							<Check size={17} /></button
						>
					</div>
				</section>
			</main>
		{:else}
			<main class="shopping">
				<section class="shopping-hero">
					<div>
						<p class="eyebrow">AKTUELLE LISTE · {openShoppingCount} OFFEN</p>
						<input
							class="list-title"
							aria-label="Titel der Einkaufsliste"
							bind:value={data.shoppingList.title}
							onblur={() => persist(() => repository.saveShoppingList(data!.shoppingList))}
						/>
					</div>
					<div class="shopping-actions">
						<button class="quiet-button" onclick={() => (inventoryOpen = true)}
							><Package size={17} /> Vorrat
							<span>{replenishCount ? `${replenishCount} knapp` : 'alles da'}</span></button
						><button class="primary" onclick={() => newShoppingItem()}><Plus size={17} /> Hinzufügen</button>
					</div>
				</section>
				<section class="shopping-card card">
					{#each SHOPPING_CATEGORIES as category, categoryIndex}{@const items = data.shoppingItems
							.filter((item) => item.category === category)
							.sort((a, b) => Number(a.isChecked) - Number(b.isChecked) || a.position - b.position)}
						<div class="shopping-group">
							<div class="group-title">
								<span>{String(categoryIndex + 1).padStart(2, '0')}</span>
								<h2>{category}</h2>
								<small>{items.filter((x) => !x.isChecked).length}</small><button
									aria-label={`${category}: Eintrag ergänzen`}
									onclick={() => newShoppingItem(category)}><Plus size={16} /></button
								>
							</div>
							{#if items.length === 0}<button class="empty-row" onclick={() => newShoppingItem(category)}
									>Noch nichts hier · Eintrag ergänzen</button
								>{/if}{#each items as item}<div class="shopping-row" class:done={item.isChecked}>
									<label
										><input
											type="checkbox"
											bind:checked={item.isChecked}
											onchange={() => persist(() => repository.saveShoppingItem(item))}
										/><span class="big-check"><Check size={17} /></span></label
									><button class="item-copy" onclick={() => (editingShopping = clone(item))}
										><b>{item.name}</b><span>{item.quantity}{item.note ? ` · ${item.note}` : ''}</span
										></button
									><button
										class="icon-button"
										aria-label={`${item.name} bearbeiten`}
										onclick={() => (editingShopping = clone(item))}><Edit3 size={16} /></button
									>
								</div>{/each}
						</div>{/each}
				</section>
			</main>
		{/if}
	{/if}
</div>

{#if inventoryOpen && data}<div
		class="overlay"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (inventoryOpen = false)}
	>
		<div class="drawer" role="dialog" aria-modal="true" aria-label="Vorrat">
			<div class="drawer-head">
				<div>
					<p class="eyebrow">DEINE KÜCHE</p>
					<h2>Vorrat</h2>
				</div>
				<button class="close" onclick={() => (inventoryOpen = false)} aria-label="Vorrat schließen"
					><X size={20} /></button
				>
			</div>
			<div class="inventory-tools">
				<label
					><Search size={16} /><input placeholder="Vorrat durchsuchen" bind:value={inventorySearch} /></label
				><select aria-label="Nach Lagerort filtern" bind:value={inventoryLocation}
					><option>Alle Orte</option>{#each LOCATIONS as location}<option>{location}</option>{/each}</select
				><button class="primary" onclick={newInventoryItem}><Plus size={17} /> Artikel</button>
			</div>
			<div class="inventory-list">
				{#if filteredInventory.length === 0}<div class="empty-state">
						<Package size={24} />
						<p>Hier ist noch nichts. Ergänze einen Vorratsartikel.</p>
					</div>{/if}{#each filteredInventory as item}<article
						class="inventory-row"
						class:due={dueState(item) === 'soon'}
						class:past={dueState(item) === 'past'}
					>
						<button class="inventory-copy" onclick={() => (editingInventory = clone(item))}
							><b>{item.name}</b><span
								>{item.location}{item.bestBefore
									? ` · bis ${new Date(item.bestBefore + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
									: ''}</span
							></button
						>{#if item.trackingType === 'exact'}<div class="quantity-control">
								<button aria-label={`${item.name} verringern`} onclick={() => decrement(item)}
									><Minus size={15} /></button
								><span><b>{item.quantity}</b> {item.unit}</span>
							</div>{:else}<button
								class="status"
								class:low={item.status === 'wenig'}
								class:empty={item.status === 'leer'}
								onclick={() => cycleStatus(item)}>{item.status}</button
							>{/if}<button
							class="basket-button"
							aria-label={`${item.name} auf Einkaufsliste`}
							onclick={() => addInventoryToShopping(item)}><ShoppingBasket size={17} /></button
						>
					</article>{/each}
			</div>
		</div>
	</div>{/if}

{#if editingShopping}<div
		class="overlay modal-overlay"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (editingShopping = null)}
	>
		<form
			class="modal"
			onsubmit={(event) => {
				event.preventDefault();
				void saveShoppingItem();
			}}
		>
			<div class="modal-head">
				<h2>Einkaufseintrag</h2>
				<button type="button" class="close" onclick={() => (editingShopping = null)}><X size={19} /></button>
			</div>
			<label
				>Name<input
					required
					maxlength="120"
					bind:value={editingShopping.name}
					placeholder="Was brauchst du?"
				/></label
			>
			<div class="form-grid">
				<label
					>Menge<input
						maxlength="60"
						bind:value={editingShopping.quantity}
						placeholder="z. B. 2 Stück"
					/></label
				><label
					>Abteilung<select bind:value={editingShopping.category}
						>{#each SHOPPING_CATEGORIES as category}<option>{category}</option>{/each}</select
					></label
				>
			</div>
			<label>Notiz<input maxlength="160" bind:value={editingShopping.note} placeholder="optional" /></label>
			<div class="modal-actions">
				{#if data?.shoppingItems.some((x) => x.id === editingShopping?.id)}<button
						type="button"
						class="danger"
						onclick={() => removeShoppingItem(editingShopping!.id)}><Trash2 size={16} /> Löschen</button
					>{/if}<button class="primary">Speichern</button>
			</div>
		</form>
	</div>{/if}

{#if editingInventory}<div
		class="overlay modal-overlay"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (editingInventory = null)}
	>
		<form
			class="modal"
			onsubmit={(event) => {
				event.preventDefault();
				void saveInventoryItem();
			}}
		>
			<div class="modal-head">
				<h2>Vorratsartikel</h2>
				<button type="button" class="close" onclick={() => (editingInventory = null)}><X size={19} /></button>
			</div>
			<label
				>Name<input
					required
					maxlength="120"
					bind:value={editingInventory.name}
					placeholder="z. B. Eier"
				/></label
			>
			<div class="segmented">
				<button
					type="button"
					class:active={editingInventory.trackingType === 'exact'}
					onclick={() => (editingInventory!.trackingType = 'exact')}>Genau verfolgen</button
				><button
					type="button"
					class:active={editingInventory.trackingType === 'basic'}
					onclick={() => (editingInventory!.trackingType = 'basic')}>Vorhanden / leer</button
				>
			</div>
			{#if editingInventory.trackingType === 'exact'}<div class="form-grid">
					<label
						>Menge<input
							type="number"
							min="0"
							step="0.1"
							required
							bind:value={editingInventory.quantity}
						/></label
					><label>Einheit<input required bind:value={editingInventory.unit} placeholder="Stück" /></label>
				</div>{/if}
			<div class="form-grid">
				<label
					>Lagerort<select bind:value={editingInventory.location}
						>{#each LOCATIONS as location}<option>{location}</option>{/each}</select
					></label
				>{#if editingInventory.trackingType === 'exact'}<label
						>Verbrauchen bis<input type="date" bind:value={editingInventory.bestBefore} /></label
					>{:else}<label
						>Status<select bind:value={editingInventory.status}
							><option value="vorhanden">vorhanden</option><option value="wenig">wenig</option><option
								value="leer">leer</option
							></select
						></label
					>{/if}
			</div>
			<label>Notiz<input maxlength="160" bind:value={editingInventory.note} placeholder="optional" /></label>
			<div class="modal-actions">
				{#if data?.inventory.some((x) => x.id === editingInventory?.id)}<button
						type="button"
						class="danger"
						onclick={() => removeInventoryItem(editingInventory!.id)}><Trash2 size={16} /> Löschen</button
					>{/if}<button class="primary">Speichern</button>
			</div>
		</form>
	</div>{/if}

{#if editingRecipe}
	<div
		class="overlay modal-overlay"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (editingRecipe = null)}
	>
		<form
			class="modal recipe-editor"
			onsubmit={(event) => {
				event.preventDefault();
				void saveRecipeEditor();
			}}
		>
			<div class="modal-head">
				<div>
					<p class="eyebrow">INHALT FÜR MENSCH & KOCH-COACH</p>
					<h2>Rezept bearbeiten</h2>
				</div>
				<button type="button" class="close" onclick={() => (editingRecipe = null)}><X size={19} /></button>
			</div>
			<h3>Mise en Place</h3>
			<div class="editor-list">
				{#each editingRecipe.prepItems as item, index}
					<label><span>{index + 1}</span><input required maxlength="300" bind:value={item.text} /></label>
				{/each}
			</div>
			<h3>Ablauf</h3>
			<div class="editor-steps">
				{#each editingRecipe.steps as step, index}
					<section>
						<b>Schritt {index + 1}</b>
						<input
							required
							maxlength="160"
							aria-label={`Titel Schritt ${index + 1}`}
							bind:value={step.title}
						/>
						<textarea
							required
							rows="6"
							aria-label={`Anleitung Schritt ${index + 1}`}
							bind:value={step.instruction}
						></textarea>
						<div class="form-grid three">
							<input
								aria-label={`Dauer Schritt ${index + 1}`}
								placeholder="Dauer"
								bind:value={step.duration}
							/><input
								aria-label={`Hitze Schritt ${index + 1}`}
								placeholder="Hitze"
								bind:value={step.temperature}
							/><input
								aria-label={`Kernziel Schritt ${index + 1}`}
								placeholder="Kernziel"
								bind:value={step.goal}
							/>
						</div>
					</section>
				{/each}
			</div>
			<div class="modal-actions">
				<button type="button" class="quiet-button" onclick={() => (editingRecipe = null)}>Abbrechen</button
				><button class="primary">Rezept speichern</button>
			</div>
		</form>
	</div>
{/if}

{#if summaryOpen && data}<div
		class="overlay modal-overlay"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && (summaryOpen = false)}
	>
		<section class="modal summary" role="dialog" aria-modal="true">
			<span class="summary-check"><Check size={25} /></span>
			<p class="eyebrow">ABEND ABGESCHLOSSEN</p>
			<h2>{data.recipe.title}</h2>
			<p>
				{finishedSteps} von {data.recipe.steps.length} Schritten erledigt. Deine Notiz und der Fortschritt bleiben
				gespeichert.
			</p>
			<button class="primary" onclick={() => (summaryOpen = false)}>Zurück zur Küche</button>
		</section>
	</div>{/if}

<style>
	.shell {
		width: min(100%, 1180px);
		margin: 0 auto;
		padding: 0 20px 90px;
	}
	header {
		height: 78px;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		border-bottom: 1px solid var(--line);
		position: sticky;
		top: 0;
		z-index: 20;
		background: rgba(9, 11, 10, 0.88);
		backdrop-filter: blur(20px) saturate(140%);
		-webkit-backdrop-filter: blur(20px) saturate(140%);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		text-decoration: none;
		width: fit-content;
	}
	.brand span {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line-strong);
		border-radius: 9px;
		font-weight: 700;
	}
	.brand b {
		font-size: 15px;
	}
	nav {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 13px;
	}
	nav button {
		border: 0;
		background: transparent;
		color: var(--muted);
		padding: 8px 17px;
		border-radius: 9px;
		font-size: 13px;
		cursor: pointer;
	}
	nav button.active {
		color: var(--text);
		background: var(--surface-3);
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset;
	}
	.account {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.account small {
		color: var(--quiet);
		font-size: 10px;
	}
	.account small.error {
		color: var(--danger);
	}
	.avatar {
		width: 31px;
		height: 31px;
		border: 1px solid var(--line);
		border-radius: 50%;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 11px;
		cursor: pointer;
	}
	.demo {
		margin: 14px auto 0;
		width: fit-content;
		color: var(--quiet);
		font-size: 11px;
		display: flex;
		gap: 7px;
		align-items: center;
	}
	.demo span {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--warning);
		box-shadow: 0 0 10px rgba(215, 185, 128, 0.35);
	}
	.error-banner {
		max-width: 680px;
		margin: 14px auto;
		padding: 10px 13px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid rgba(215, 152, 144, 0.25);
		border-radius: 10px;
		background: rgba(215, 152, 144, 0.07);
		color: var(--danger);
		font-size: 12px;
	}
	.error-banner button {
		background: none;
		border: 0;
		color: inherit;
		cursor: pointer;
	}
	.loading {
		min-height: 70vh;
		display: grid;
		place-content: center;
		text-align: center;
		color: var(--quiet);
		font-size: 12px;
	}
	.loading div {
		width: 28px;
		height: 28px;
		border: 2px solid var(--line);
		border-top-color: var(--accent);
		border-radius: 50%;
		margin: auto;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.cook {
		padding-top: 64px;
	}
	.hero {
		max-width: 860px;
		margin-bottom: 38px;
	}
	.recipe-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 14px;
	}
	.recipe-meta input {
		border: 0;
		background: transparent;
		color: var(--quiet);
		padding: 0;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		width: 100px;
	}
	.recipe-meta label {
		color: var(--quiet);
		font-size: 10px;
		letter-spacing: 0.11em;
		font-weight: 700;
	}
	.recipe-meta label input {
		width: 25px;
		color: var(--muted);
	}
	.recipe-title {
		display: block;
		width: 100%;
		height: auto;
		min-height: 1.08em;
		max-height: 2.08em;
		field-sizing: content;
		overflow: hidden;
		resize: none;
		border: 0;
		background: transparent;
		padding: 0;
		font-size: clamp(43px, 7vw, 84px);
		line-height: 1;
		letter-spacing: -0.063em;
		font-weight: 530;
		color: var(--text);
	}
	.focus-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-top: 20px;
	}
	.focus {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 10px;
		color: var(--quiet);
		font-size: 12px;
		margin: 0;
	}
	.focus input {
		min-width: 0;
		width: min(360px, 70vw);
		flex: 1;
		border: 0;
		border-bottom: 1px solid transparent;
		border-radius: 0;
		padding: 4px 0;
		background: transparent;
		color: var(--muted);
	}
	.focus input:focus {
		border-bottom-color: var(--line-strong);
	}
	.recipe-edit {
		min-height: 36px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 0 10px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--quiet);
		font-size: 11px;
		cursor: pointer;
	}
	.recipe-edit:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.cook-grid {
		display: grid;
		grid-template-columns: 0.86fr 1.14fr;
		gap: 14px;
		align-items: start;
	}
	.card {
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.018), transparent 55%), var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		box-shadow: 0 18px 70px rgba(0, 0, 0, 0.14);
	}
	.prep-card,
	.steps-card {
		padding: 22px;
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 18px;
		color: var(--muted);
	}
	.section-title h2 {
		margin: 0;
		color: var(--text);
		font-size: 16px;
		letter-spacing: -0.02em;
		font-weight: 600;
	}
	.section-title small {
		margin-left: auto;
		color: var(--quiet);
		font-size: 9px;
		letter-spacing: 0.12em;
	}
	.collapse-button {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--quiet);
		cursor: pointer;
	}
	.collapse-button:hover {
		background: var(--surface-3);
		color: var(--text);
	}
	.collapse-button :global(svg) {
		transition: transform 0.18s ease;
	}
	.collapse-button.collapsed :global(svg) {
		transform: rotate(-90deg);
	}
	.prep-card.collapsed .section-title {
		margin-bottom: 0;
	}
	.checklist label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 53px;
		border-top: 1px solid var(--line);
		font-size: 13px;
		cursor: pointer;
		transition: 0.2s;
	}
	.checklist label.done {
		color: var(--quiet);
		text-decoration: line-through;
	}
	.checklist input,
	.shopping-row label input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.check,
	.big-check {
		border: 1px solid var(--line-strong);
		display: grid;
		place-items: center;
		color: transparent;
		flex: 0 0 auto;
		transition: 0.15s;
	}
	.check {
		width: 26px;
		height: 26px;
		border-radius: 7px;
	}
	.done .check,
	.shopping-row.done .big-check {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}
	.step {
		width: 100%;
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) 40px;
		gap: 12px;
		align-items: start;
		text-align: left;
		border-top: 1px solid var(--line);
		background: transparent;
		min-height: 69px;
		padding: 18px 4px;
		color: var(--muted);
	}
	.step.current {
		background: rgba(217, 230, 207, 0.045);
		box-shadow: inset 2px 0 var(--accent);
		color: var(--text);
	}
	.step.done {
		opacity: 0.43;
	}
	.number {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: 12px;
		font-size: 12px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.step-copy {
		min-width: 0;
	}
	.step-heading {
		width: 100%;
		min-height: 40px;
		display: flex;
		align-items: center;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
		padding: 0;
		cursor: pointer;
	}
	.step-heading b {
		font-size: 14px;
		font-weight: 540;
		color: inherit;
	}
	.step-facts {
		display: flex;
		flex-wrap: wrap;
		gap: 5px 12px;
		margin-top: 2px;
		font-size: 10px;
		color: var(--quiet);
	}
	.instruction {
		display: grid;
		grid-column: 1/-1;
		gap: 0;
		margin-top: 4px;
		max-width: 60ch;
	}
	.coach-line {
		display: grid;
		grid-template-columns: 22px 1fr;
		gap: 10px;
		padding: 10px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		color: var(--muted);
		font-size: 13px;
		line-height: 1.62;
	}
	.coach-line i {
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 6px;
		background: var(--surface-3);
		color: var(--quiet);
		font-size: 9px;
		font-style: normal;
		margin-top: 1px;
	}
	.step-goal {
		display: grid;
		gap: 4px;
		margin-top: 12px;
		padding: 12px;
		border: 1px solid rgba(225, 233, 219, 0.11);
		border-radius: 11px;
		background: rgba(225, 233, 219, 0.035);
		color: var(--muted);
		font-size: 12px;
		line-height: 1.45;
	}
	.step-goal b {
		color: var(--accent);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.complete-step {
		min-height: 44px;
		width: 100%;
		margin-top: 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid var(--line-strong);
		border-radius: 11px;
		background: var(--surface-3);
		color: var(--text);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.expand-button {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--quiet);
		cursor: pointer;
	}
	:global(.step-chevron) {
		color: var(--quiet);
		transition: transform 0.18s;
	}
	:global(.step:has([aria-expanded='true']) .step-chevron) {
		transform: rotate(180deg);
	}
	.finish-card {
		margin-top: 14px;
		padding: 22px;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 12px 20px;
	}
	.finish-card > label {
		grid-column: 1/-1;
		font-size: 11px;
		color: var(--quiet);
	}
	.finish-card textarea {
		resize: vertical;
		width: 100%;
		padding: 12px;
		min-height: 58px;
	}
	.finish-card > div {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.primary,
	.quiet-button,
	.danger {
		min-height: 44px;
		border-radius: 11px;
		padding: 0 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		cursor: pointer;
		border: 1px solid var(--line-strong);
		white-space: nowrap;
	}
	.primary {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-weight: 620;
	}
	.quiet-button {
		background: var(--surface-2);
		color: var(--muted);
	}
	.danger {
		background: transparent;
		color: var(--danger);
		border-color: rgba(215, 152, 144, 0.2);
		margin-right: auto;
	}
	.shopping {
		padding-top: 68px;
	}
	.shopping-hero {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 20px;
		margin-bottom: 34px;
	}
	.eyebrow {
		color: var(--quiet);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.16em;
		margin: 0 0 13px;
	}
	.list-title {
		width: min(650px, 65vw);
		padding: 0;
		border: 0;
		background: transparent;
		font-size: clamp(37px, 6vw, 68px);
		line-height: 1;
		letter-spacing: -0.055em;
		color: var(--text);
	}
	.shopping-actions {
		display: flex;
		gap: 8px;
	}
	.shopping-actions .quiet-button span {
		border-left: 1px solid var(--line);
		padding-left: 8px;
		color: var(--quiet);
	}
	.shopping-card {
		padding: 7px 25px;
	}
	.shopping-group {
		padding: 18px 0;
		border-bottom: 1px solid var(--line);
	}
	.shopping-group:last-child {
		border-bottom: 0;
	}
	.group-title {
		display: grid;
		grid-template-columns: 31px 1fr auto auto;
		align-items: center;
		min-height: 38px;
		gap: 9px;
	}
	.group-title > span {
		color: var(--quiet);
		font-size: 9px;
		letter-spacing: 0.1em;
	}
	.group-title h2 {
		margin: 0;
		font-size: 13px;
		font-weight: 560;
	}
	.group-title small {
		color: var(--quiet);
		font-size: 10px;
	}
	.group-title button,
	.icon-button {
		border: 0;
		background: transparent;
		color: var(--quiet);
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		cursor: pointer;
		border-radius: 9px;
	}
	.group-title button:hover,
	.icon-button:hover {
		background: var(--surface-3);
		color: var(--text);
	}
	.shopping-row {
		display: grid;
		grid-template-columns: 46px 1fr 44px;
		align-items: center;
		min-height: 64px;
		border-top: 1px solid rgba(255, 255, 255, 0.045);
	}
	.shopping-row.done {
		opacity: 0.42;
	}
	.shopping-row label {
		min-width: 46px;
		min-height: 58px;
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	.big-check {
		width: 30px;
		height: 30px;
		border-radius: 10px;
	}
	.item-copy {
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
		padding: 8px 0;
	}
	.item-copy b,
	.item-copy span {
		display: block;
	}
	.item-copy b {
		color: var(--text);
		font-size: 14px;
		font-weight: 520;
	}
	.item-copy span {
		color: var(--quiet);
		font-size: 11px;
		margin-top: 4px;
	}
	.empty-row {
		border: 0;
		background: transparent;
		color: var(--quiet);
		padding: 9px 0 3px 40px;
		cursor: pointer;
		font-size: 11px;
		text-align: left;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(9px);
		display: flex;
		justify-content: flex-end;
	}
	.drawer {
		width: min(600px, 94vw);
		height: 100%;
		overflow: auto;
		background: #0f120f;
		border-left: 1px solid var(--line);
		padding: 30px 28px max(30px, env(safe-area-inset-bottom));
		box-shadow: -30px 0 100px rgba(0, 0, 0, 0.35);
	}
	.drawer-head,
	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.drawer-head h2,
	.modal-head h2 {
		margin: 0;
		font-size: 28px;
		letter-spacing: -0.04em;
		font-weight: 560;
	}
	.close {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		background: var(--surface-2);
		border-radius: 11px;
		color: var(--muted);
		cursor: pointer;
	}
	.inventory-tools {
		display: grid;
		grid-template-columns: 1fr 150px auto;
		gap: 8px;
		margin: 28px 0 18px;
	}
	.inventory-tools > label {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		border-radius: 11px;
		padding-left: 11px;
		color: var(--quiet);
	}
	.inventory-tools input {
		min-width: 0;
		width: 100%;
		border: 0;
		background: transparent;
		padding: 10px 4px;
	}
	.inventory-tools select {
		padding: 0 10px;
	}
	.inventory-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 38px;
		gap: 9px;
		align-items: center;
		min-height: 72px;
		border-top: 1px solid var(--line);
	}
	.inventory-row.due {
		box-shadow: inset 2px 0 var(--warning);
		padding-left: 10px;
	}
	.inventory-row.past {
		box-shadow: inset 2px 0 var(--danger);
		padding-left: 10px;
	}
	.inventory-copy {
		min-width: 0;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}
	.inventory-copy b,
	.inventory-copy span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.inventory-copy b {
		color: var(--text);
		font-size: 13px;
		font-weight: 540;
	}
	.inventory-copy span {
		color: var(--quiet);
		font-size: 10px;
		margin-top: 5px;
	}
	.quantity-control {
		display: flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: 9px;
		overflow: hidden;
	}
	.quantity-control button {
		width: 40px;
		height: 40px;
		border: 0;
		border-right: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--muted);
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.quantity-control span {
		padding: 0 9px;
		color: var(--quiet);
		font-size: 10px;
	}
	.quantity-control b {
		color: var(--text);
		font-size: 12px;
	}
	.status {
		min-width: 76px;
		height: 38px;
		border-radius: 9px;
		border: 1px solid rgba(217, 230, 207, 0.15);
		background: rgba(217, 230, 207, 0.06);
		color: var(--accent);
		font-size: 10px;
		cursor: pointer;
	}
	.status.low {
		color: var(--warning);
		border-color: rgba(215, 185, 128, 0.2);
	}
	.status.empty {
		color: var(--danger);
		border-color: rgba(215, 152, 144, 0.2);
	}
	.basket-button {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--quiet);
		cursor: pointer;
	}
	.basket-button:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.empty-state {
		min-height: 220px;
		display: grid;
		place-content: center;
		text-align: center;
		color: var(--quiet);
		font-size: 12px;
	}
	.modal-overlay {
		justify-content: center;
		align-items: center;
		padding: 18px;
	}
	.modal {
		width: min(520px, 100%);
		background: #121512;
		border: 1px solid var(--line-strong);
		border-radius: 22px;
		padding: 23px;
		box-shadow: 0 30px 120px rgba(0, 0, 0, 0.55);
	}
	.modal-head {
		margin-bottom: 22px;
	}
	.modal-head h2 {
		font-size: 20px;
	}
	.modal > label,
	.form-grid label {
		display: grid;
		gap: 7px;
		color: var(--quiet);
		font-size: 10px;
		margin-top: 14px;
	}
	.modal input,
	.modal select {
		width: 100%;
		min-height: 42px;
		padding: 0 11px;
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.segmented {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		margin-top: 18px;
		padding: 4px;
		border: 1px solid var(--line);
		background: var(--surface);
		border-radius: 12px;
	}
	.segmented button {
		border: 0;
		background: transparent;
		color: var(--quiet);
		min-height: 36px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 11px;
	}
	.segmented button.active {
		background: var(--surface-3);
		color: var(--text);
	}
	.modal-actions {
		margin-top: 24px;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.recipe-editor {
		width: min(760px, 100%);
		max-height: 92vh;
		overflow: auto;
	}
	.recipe-editor h3 {
		margin: 24px 0 10px;
		font-size: 12px;
		font-weight: 600;
		color: var(--muted);
	}
	.editor-list {
		display: grid;
		gap: 7px;
	}
	.editor-list label {
		display: grid;
		grid-template-columns: 24px 1fr;
		align-items: center;
		gap: 8px;
	}
	.editor-list label span {
		color: var(--quiet);
		font-size: 10px;
		text-align: center;
	}
	.editor-steps {
		display: grid;
		gap: 10px;
	}
	.editor-steps section {
		display: grid;
		gap: 8px;
		padding: 14px;
		border: 1px solid var(--line);
		border-radius: 13px;
		background: rgba(255, 255, 255, 0.012);
	}
	.editor-steps section > b {
		font-size: 10px;
		color: var(--quiet);
	}
	.editor-steps textarea {
		width: 100%;
		padding: 11px;
		resize: vertical;
		line-height: 1.5;
	}
	.form-grid.three {
		grid-template-columns: 0.65fr 1fr 1.5fr;
	}
	.summary {
		text-align: center;
	}
	.summary-check {
		margin: 0 auto 20px;
		width: 48px;
		height: 48px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		color: var(--accent-ink);
		background: var(--accent);
	}
	.summary h2 {
		margin: 0;
		font-size: 27px;
		letter-spacing: -0.04em;
	}
	.summary p:not(.eyebrow) {
		color: var(--muted);
		font-size: 12px;
		line-height: 1.6;
		margin: 13px auto 22px;
		max-width: 38ch;
	}
	@media (max-width: 720px) {
		.shell {
			padding-inline: 14px;
			padding-bottom: 70px;
		}
		header {
			height: 68px;
		}
		.brand b {
			display: none;
		}
		nav button {
			padding-inline: 14px;
		}
		.account small {
			display: none;
		}
		.recipe-edit {
			width: 38px;
			padding: 0;
			font-size: 0;
			justify-content: center;
		}
		.cook,
		.shopping {
			padding-top: 34px;
		}
		.recipe-title {
			font-size: 40px;
		}
		.hero {
			margin-bottom: 22px;
		}
		.cook-grid {
			grid-template-columns: 1fr;
		}
		.cook-grid.prep-ready .steps-card {
			order: -1;
		}
		.card {
			border-radius: 19px;
		}
		.prep-card,
		.steps-card {
			padding: 18px;
		}
		.finish-card {
			grid-template-columns: 1fr;
			padding: 18px;
		}
		.finish-card > label {
			grid-column: auto;
		}
		.finish-card > div {
			flex-direction: row;
			flex-wrap: wrap;
		}
		.finish-card > div button {
			flex: 1;
		}
		.shopping-hero {
			display: grid;
			align-items: start;
		}
		.list-title {
			width: 100%;
			font-size: 45px;
		}
		.shopping-actions {
			order: 2;
		}
		.shopping-actions > button {
			flex: 1;
		}
		.shopping-card {
			padding: 4px 17px;
		}
		.drawer {
			width: 100%;
			max-width: none;
			border-left: 0;
			border-top: 1px solid var(--line);
			border-radius: 22px 22px 0 0;
			height: 92vh;
			align-self: end;
			padding: 23px 17px max(23px, env(safe-area-inset-bottom));
		}
		.overlay:has(.drawer) {
			align-items: flex-end;
		}
		.inventory-tools {
			grid-template-columns: 1fr auto;
		}
		.inventory-tools > label {
			grid-column: 1/-1;
		}
		.inventory-tools select {
			min-width: 0;
		}
		.form-grid {
			grid-template-columns: 1fr;
		}
		.form-grid.three {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 390px) {
		.recipe-title {
			font-size: 38px;
		}
		.inventory-row {
			grid-template-columns: minmax(0, 1fr) 36px;
			min-height: 0;
			padding: 11px 0;
			row-gap: 8px;
		}
		.quantity-control,
		.status {
			grid-column: 1/2;
			width: fit-content;
		}
		.basket-button {
			grid-column: 2;
			grid-row: 1/3;
		}
	}
</style>
