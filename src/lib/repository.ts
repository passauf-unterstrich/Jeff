import type { SupabaseClient } from '@supabase/supabase-js';
import { createSeedData } from './seed';
import type {
	AppData,
	InventoryItem,
	Recipe,
	RecipeNote,
	ShoppingItem,
	ShoppingList,
	CookingSession
} from './types';

export interface Repository {
	load(recipeId?: string): Promise<AppData>;
	saveRecipe(value: Recipe): Promise<void>;
	saveSession(value: CookingSession): Promise<void>;
	saveNote(value: RecipeNote): Promise<void>;
	saveShoppingList(value: ShoppingList): Promise<void>;
	createShoppingList(value: ShoppingList): Promise<void>;
	saveShoppingItem(value: ShoppingItem): Promise<void>;
	deleteShoppingItem(id: string): Promise<void>;
	saveInventoryItem(value: InventoryItem): Promise<void>;
	deleteInventoryItem(id: string): Promise<void>;
	checkoutShoppingList(id: string): Promise<void>;
	completeCooking(sessionId: string): Promise<void>;
	archiveRecipe(id: string): Promise<void>;
	completeRecipe(id: string): Promise<void>;
}

const STORAGE_KEY = 'jeff-demo-data-v4';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class DemoRepository implements Repository {
	private data!: AppData;
	async load(recipeId?: string) {
		const stored = localStorage.getItem(STORAGE_KEY);
		const fresh = createSeedData();
		this.data = stored ? JSON.parse(stored) : fresh;
		this.data.recipe.steps = this.data.recipe.steps.map((step, index) => ({
			...step,
			science: step.science || fresh.recipe.steps[index]?.science || ''
		}));
		this.data.recipe.isFavorite ??= false;
		this.data.recipe.status ??= this.data.session.completedAt ? 'completed' : 'active';
		this.data.recipe.consumptions ??= fresh.recipe.consumptions;
		this.data.shoppingList.checkedOutAt ??= null;
		const freshShopping = new Map(fresh.shoppingItems.map((item) => [item.name.toLowerCase(), item]));
		this.data.shoppingItems = this.data.shoppingItems.map((item) => {
			const fallback = freshShopping.get(item.name.toLowerCase());
			return {
				...item,
				addedToInventory: item.addedToInventory ?? false,
				inventoryTrackingType: item.inventoryTrackingType ?? fallback?.inventoryTrackingType ?? 'exact',
				inventoryQuantity: item.inventoryQuantity ?? fallback?.inventoryQuantity ?? 1,
				inventoryUnit: item.inventoryUnit ?? fallback?.inventoryUnit ?? 'Stück',
				inventoryLocation: item.inventoryLocation ?? fallback?.inventoryLocation ?? 'Vorratsschrank',
				rememberForNext: item.rememberForNext ?? false
			};
		});
		const currentSummary = {
			id: this.data.recipe.id,
			title: this.data.recipe.title,
			cookDate: this.data.recipe.cookDate,
			learningFocus: this.data.recipe.learningFocus,
			completedAt: this.data.session.completedAt,
			isFavorite: this.data.recipe.isFavorite,
			status: this.data.recipe.status
		};
		this.data.recipeHistory =
			this.data.recipe.status === 'completed'
				? [currentSummary]
				: (this.data.recipeHistory ?? [])
						.filter((item) => item.completedAt)
						.map((item) => ({
							...item,
							isFavorite: item.isFavorite ?? false,
							status: 'completed'
						}));
		this.data.recipeArchive = this.data.recipe.status === 'archived' ? [currentSummary] : [];
		this.data.hasActiveRecipe = this.data.recipe.status === 'active';
		if (recipeId && recipeId !== this.data.recipe.id) throw new Error('Rezept nicht gefunden.');
		this.flush();
		return clone(this.data);
	}
	private flush() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
	}
	async saveRecipe(value: Recipe) {
		this.data.recipe = clone(value);
		const historyItem = this.data.recipeHistory.find((item) => item.id === value.id);
		if (historyItem) {
			historyItem.title = value.title;
			historyItem.cookDate = value.cookDate;
			historyItem.learningFocus = value.learningFocus;
			historyItem.isFavorite = value.isFavorite;
		}
		const archiveItem = this.data.recipeArchive.find((item) => item.id === value.id);
		if (archiveItem) archiveItem.isFavorite = value.isFavorite;
		this.flush();
	}
	async saveSession(value: CookingSession) {
		this.data.session = clone(value);
		this.flush();
	}
	async saveNote(value: RecipeNote) {
		this.data.note = clone(value);
		this.flush();
	}
	async saveShoppingList(value: ShoppingList) {
		this.data.shoppingList = clone(value);
		this.flush();
	}
	async createShoppingList(value: ShoppingList) {
		this.data.shoppingList = clone(value);
		this.data.shoppingItems = [];
		this.flush();
	}
	async saveShoppingItem(value: ShoppingItem) {
		const i = this.data.shoppingItems.findIndex((item) => item.id === value.id);
		if (i >= 0) this.data.shoppingItems[i] = clone(value);
		else this.data.shoppingItems.push(clone(value));
		this.flush();
	}
	async deleteShoppingItem(id: string) {
		this.data.shoppingItems = this.data.shoppingItems.filter((item) => item.id !== id);
		this.flush();
	}
	async saveInventoryItem(value: InventoryItem) {
		const i = this.data.inventory.findIndex((item) => item.id === value.id);
		if (i >= 0) this.data.inventory[i] = clone(value);
		else this.data.inventory.push(clone(value));
		this.flush();
	}
	async deleteInventoryItem(id: string) {
		this.data.inventory = this.data.inventory.filter((item) => item.id !== id);
		this.flush();
	}
	async checkoutShoppingList(id: string) {
		if (this.data.shoppingList.id !== id || this.data.shoppingList.checkedOutAt) return;
		for (const item of this.data.shoppingItems.filter(
			(entry) => entry.isChecked && !entry.addedToInventory
		)) {
			const existing = this.data.inventory.find(
				(entry) =>
					entry.name.toLowerCase() === item.name.toLowerCase() &&
					entry.trackingType === item.inventoryTrackingType &&
					(item.inventoryTrackingType === 'basic' ||
						(entry.unit === item.inventoryUnit && entry.location === item.inventoryLocation))
			);
			if (existing) {
				existing.status = 'vorhanden';
				if (existing.trackingType === 'exact')
					existing.quantity = Number(((existing.quantity ?? 0) + (item.inventoryQuantity ?? 0)).toFixed(2));
			} else {
				this.data.inventory.push({
					id: crypto.randomUUID(),
					name: item.name,
					trackingType: item.inventoryTrackingType,
					quantity: item.inventoryTrackingType === 'exact' ? (item.inventoryQuantity ?? 0) : null,
					unit: item.inventoryUnit,
					location: item.inventoryLocation,
					status: 'vorhanden',
					bestBefore: '',
					note: 'Aus Einkauf übernommen'
				});
			}
			item.addedToInventory = true;
			item.rememberForNext = false;
		}
		this.data.shoppingList.checkedOutAt = new Date().toISOString();
		this.flush();
	}
	async completeCooking(sessionId: string) {
		if (this.data.session.id !== sessionId || this.data.session.completedAt) return;
		for (const usage of this.data.recipe.consumptions.filter((item) => item.trackingType === 'exact')) {
			const existing = this.data.inventory.find(
				(item) =>
					item.trackingType === 'exact' &&
					item.name.toLowerCase() === usage.inventoryName.toLowerCase() &&
					item.unit === usage.unit
			);
			if (!existing) continue;
			existing.quantity = Math.max(0, Number(((existing.quantity ?? 0) - usage.quantity).toFixed(2)));
			existing.status = existing.quantity === 0 ? 'leer' : 'vorhanden';
		}
		this.data.session.completedAt = new Date().toISOString();
		this.data.recipe.status = 'completed';
		this.data.hasActiveRecipe = false;
		this.data.recipeArchive = [];
		this.data.recipeHistory = [
			{
				id: this.data.recipe.id,
				title: this.data.recipe.title,
				cookDate: this.data.recipe.cookDate,
				learningFocus: this.data.recipe.learningFocus,
				completedAt: this.data.session.completedAt,
				isFavorite: this.data.recipe.isFavorite,
				status: 'completed'
			}
		];
		this.flush();
	}
	async archiveRecipe(id: string) {
		if (this.data.recipe.id !== id || this.data.recipe.status !== 'active') return;
		this.data.recipe.status = 'archived';
		this.data.hasActiveRecipe = false;
		this.data.recipeArchive = [
			{
				id: this.data.recipe.id,
				title: this.data.recipe.title,
				cookDate: this.data.recipe.cookDate,
				learningFocus: this.data.recipe.learningFocus,
				completedAt: null,
				isFavorite: this.data.recipe.isFavorite,
				status: 'archived'
			}
		];
		this.flush();
	}
	async completeRecipe(id: string) {
		if (this.data.recipe.id !== id) throw new Error('Rezept nicht gefunden.');
		await this.completeCooking(this.data.session.id);
	}
}

const check = (error: { message: string } | null) => {
	if (error) throw new Error(error.message);
};

export class SupabaseRepository implements Repository {
	constructor(
		private client: SupabaseClient,
		private userId: string
	) {}

	async load(recipeId?: string): Promise<AppData> {
		const recipeQuery = this.client.from('recipes').select('*');
		let recipeResult = recipeId
			? await recipeQuery.eq('id', recipeId).maybeSingle()
			: await recipeQuery
					.eq('status', 'active')
					.order('created_at', { ascending: false })
					.limit(1)
					.maybeSingle();
		if (!recipeId && !recipeResult.data && !recipeResult.error) {
			recipeResult = await this.client
				.from('recipes')
				.select('*')
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();
		}
		const { data: recipeRow, error } = recipeResult;
		check(error);
		if (!recipeRow) {
			await this.seed();
			return this.load();
		}
		const loadedRecipeId = recipeRow.id;
		const [prep, steps, consumptions, sessions, notes, lists, inventory, historyRows, historySessions] =
			await Promise.all([
				this.client.from('recipe_prep_items').select('*').eq('recipe_id', loadedRecipeId).order('position'),
				this.client.from('recipe_steps').select('*').eq('recipe_id', loadedRecipeId).order('position'),
				this.client.from('recipe_consumptions').select('*').eq('recipe_id', loadedRecipeId).order('position'),
				this.client
					.from('cooking_sessions')
					.select('*')
					.eq('recipe_id', loadedRecipeId)
					.order('created_at', { ascending: false })
					.limit(1),
				this.client.from('recipe_notes').select('*').eq('recipe_id', loadedRecipeId).limit(1),
				this.client.from('shopping_lists').select('*').order('created_at', { ascending: false }).limit(1),
				this.client.from('inventory_items').select('*').order('name'),
				this.client
					.from('recipes')
					.select('id,title,cook_date,learning_focus,is_favorite,status')
					.order('cook_date', { ascending: false }),
				this.client
					.from('cooking_sessions')
					.select('recipe_id,completed_at,created_at')
					.order('created_at', { ascending: false })
			]);
		for (const result of [
			prep,
			steps,
			consumptions,
			sessions,
			notes,
			lists,
			inventory,
			historyRows,
			historySessions
		])
			check(result.error);
		const listRow = lists.data![0];
		const shopping = await this.client
			.from('shopping_items')
			.select('*')
			.eq('list_id', listRow.id)
			.order('position');
		check(shopping.error);
		const sessionRow = sessions.data![0];
		const noteRow = notes.data![0];
		const completionByRecipe = new Map<string, string | null>();
		for (const session of historySessions.data ?? []) {
			if (!completionByRecipe.has(session.recipe_id))
				completionByRecipe.set(session.recipe_id, session.completed_at);
		}
		return {
			recipe: {
				id: recipeRow.id,
				title: recipeRow.title,
				cookDate: recipeRow.cook_date ?? '',
				servings: recipeRow.servings,
				learningFocus: recipeRow.learning_focus ?? '',
				isFavorite: recipeRow.is_favorite ?? false,
				status: recipeRow.status,
				prepItems: prep.data!.map((r) => ({
					id: r.id,
					recipeId: r.recipe_id,
					position: r.position,
					text: r.text
				})),
				steps: steps.data!.map((r) => ({
					id: r.id,
					recipeId: r.recipe_id,
					position: r.position,
					title: r.title,
					instruction: r.instruction,
					duration: r.duration ?? '',
					temperature: r.temperature ?? '',
					goal: r.goal ?? '',
					science: r.science ?? ''
				})),
				consumptions: consumptions.data!.map((r) => ({
					id: r.id,
					recipeId: r.recipe_id,
					position: r.position,
					inventoryName: r.inventory_name,
					quantity: Number(r.quantity),
					unit: r.unit ?? '',
					trackingType: r.tracking_type
				}))
			},
			session: {
				id: sessionRow.id,
				recipeId: sessionRow.recipe_id,
				prepProgress: sessionRow.prep_progress ?? {},
				stepProgress: sessionRow.step_progress ?? {},
				completedAt: sessionRow.completed_at
			},
			note: { id: noteRow.id, recipeId: noteRow.recipe_id, content: noteRow.content ?? '' },
			shoppingList: {
				id: listRow.id,
				title: listRow.title,
				startDate: listRow.start_date ?? '',
				endDate: listRow.end_date ?? '',
				checkedOutAt: listRow.completed_at
			},
			shoppingItems: shopping.data!.map((r) => ({
				id: r.id,
				listId: r.list_id,
				name: r.name,
				quantity: r.quantity ?? '',
				note: r.note ?? '',
				category: r.category,
				position: r.position,
				isChecked: r.is_checked,
				addedToInventory: r.added_to_inventory,
				inventoryTrackingType: r.inventory_tracking_type,
				inventoryQuantity: r.inventory_quantity === null ? null : Number(r.inventory_quantity),
				inventoryUnit: r.inventory_unit ?? '',
				inventoryLocation: r.inventory_location,
				rememberForNext: r.remember_for_next
			})),
			inventory: inventory.data!.map((r) => ({
				id: r.id,
				name: r.name,
				trackingType: r.tracking_type,
				quantity: r.quantity === null ? null : Number(r.quantity),
				unit: r.unit ?? '',
				location: r.location,
				status: r.status,
				bestBefore: r.best_before ?? '',
				note: r.note ?? ''
			})),
			recipeHistory: (historyRows.data ?? [])
				.filter((row) => row.status === 'completed')
				.map((row) => ({
					id: row.id,
					title: row.title,
					cookDate: row.cook_date ?? '',
					learningFocus: row.learning_focus ?? '',
					completedAt: completionByRecipe.get(row.id) ?? null,
					isFavorite: row.is_favorite ?? false,
					status: row.status
				})),
			recipeArchive: (historyRows.data ?? [])
				.filter((row) => row.status === 'archived')
				.map((row) => ({
					id: row.id,
					title: row.title,
					cookDate: row.cook_date ?? '',
					learningFocus: row.learning_focus ?? '',
					completedAt: null,
					isFavorite: row.is_favorite ?? false,
					status: row.status
				})),
			hasActiveRecipe: recipeRow.status === 'active'
		};
	}

	private async seed() {
		const d = createSeedData();
		check(
			(
				await this.client.from('recipes').insert({
					id: d.recipe.id,
					user_id: this.userId,
					title: d.recipe.title,
					cook_date: d.recipe.cookDate,
					servings: d.recipe.servings,
					learning_focus: d.recipe.learningFocus,
					is_favorite: d.recipe.isFavorite,
					status: d.recipe.status
				})
			).error
		);
		check(
			(
				await this.client.from('recipe_consumptions').insert(
					d.recipe.consumptions.map((x) => ({
						id: x.id,
						user_id: this.userId,
						recipe_id: x.recipeId,
						position: x.position,
						inventory_name: x.inventoryName,
						quantity: x.quantity,
						unit: x.unit,
						tracking_type: x.trackingType
					}))
				)
			).error
		);
		check(
			(
				await this.client.from('recipe_prep_items').insert(
					d.recipe.prepItems.map((x) => ({
						id: x.id,
						user_id: this.userId,
						recipe_id: x.recipeId,
						position: x.position,
						text: x.text
					}))
				)
			).error
		);
		check(
			(
				await this.client.from('recipe_steps').insert(
					d.recipe.steps.map((x) => ({
						id: x.id,
						user_id: this.userId,
						recipe_id: x.recipeId,
						position: x.position,
						title: x.title,
						instruction: x.instruction,
						duration: x.duration || null,
						temperature: x.temperature || null,
						goal: x.goal || null,
						science: x.science || null
					}))
				)
			).error
		);
		check(
			(
				await this.client.from('cooking_sessions').insert({
					id: d.session.id,
					user_id: this.userId,
					recipe_id: d.recipe.id,
					prep_progress: {},
					step_progress: {}
				})
			).error
		);
		check(
			(
				await this.client
					.from('recipe_notes')
					.insert({ id: d.note.id, user_id: this.userId, recipe_id: d.recipe.id, content: '' })
			).error
		);
		check(
			(
				await this.client.from('shopping_lists').insert({
					id: d.shoppingList.id,
					user_id: this.userId,
					title: d.shoppingList.title,
					completed_at: d.shoppingList.checkedOutAt
				})
			).error
		);
		check(
			(
				await this.client.from('shopping_items').insert(
					d.shoppingItems.map((x) => ({
						id: x.id,
						user_id: this.userId,
						list_id: x.listId,
						name: x.name,
						quantity: x.quantity,
						note: x.note || null,
						category: x.category,
						position: x.position,
						is_checked: false,
						added_to_inventory: x.addedToInventory,
						inventory_tracking_type: x.inventoryTrackingType,
						inventory_quantity: x.inventoryQuantity,
						inventory_unit: x.inventoryUnit,
						inventory_location: x.inventoryLocation,
						remember_for_next: x.rememberForNext
					}))
				)
			).error
		);
		check(
			(
				await this.client.from('inventory_items').insert(
					d.inventory.map((x) => ({
						id: x.id,
						user_id: this.userId,
						name: x.name,
						tracking_type: x.trackingType,
						quantity: x.quantity,
						unit: x.unit || null,
						location: x.location,
						status: x.status,
						best_before: x.bestBefore || null,
						note: x.note || null
					}))
				)
			).error
		);
	}

	async saveRecipe(v: Recipe) {
		check(
			(
				await this.client
					.from('recipes')
					.update({
						title: v.title,
						cook_date: v.cookDate || null,
						servings: v.servings,
						learning_focus: v.learningFocus,
						is_favorite: v.isFavorite,
						status: v.status
					})
					.eq('id', v.id)
			).error
		);
		if (v.prepItems.length > 0)
			check(
				(
					await this.client.from('recipe_prep_items').upsert(
						v.prepItems.map((item) => ({
							id: item.id,
							user_id: this.userId,
							recipe_id: v.id,
							position: item.position,
							text: item.text
						}))
					)
				).error
			);
		if (v.steps.length > 0)
			check(
				(
					await this.client.from('recipe_steps').upsert(
						v.steps.map((step) => ({
							id: step.id,
							user_id: this.userId,
							recipe_id: v.id,
							position: step.position,
							title: step.title,
							instruction: step.instruction,
							duration: step.duration || null,
							temperature: step.temperature || null,
							goal: step.goal || null,
							science: step.science || null
						}))
					)
				).error
			);
		if (v.consumptions.length > 0)
			check(
				(
					await this.client.from('recipe_consumptions').upsert(
						v.consumptions.map((usage) => ({
							id: usage.id,
							user_id: this.userId,
							recipe_id: v.id,
							position: usage.position,
							inventory_name: usage.inventoryName,
							quantity: usage.quantity,
							unit: usage.unit,
							tracking_type: usage.trackingType
						}))
					)
				).error
			);

		let prepDelete = this.client
			.from('recipe_prep_items')
			.delete()
			.eq('recipe_id', v.id)
			.eq('user_id', this.userId);
		if (v.prepItems.length > 0)
			prepDelete = prepDelete.not('id', 'in', `(${v.prepItems.map((item) => item.id).join(',')})`);
		check((await prepDelete).error);

		let stepDelete = this.client
			.from('recipe_steps')
			.delete()
			.eq('recipe_id', v.id)
			.eq('user_id', this.userId);
		if (v.steps.length > 0)
			stepDelete = stepDelete.not('id', 'in', `(${v.steps.map((step) => step.id).join(',')})`);
		check((await stepDelete).error);

		let consumptionDelete = this.client
			.from('recipe_consumptions')
			.delete()
			.eq('recipe_id', v.id)
			.eq('user_id', this.userId);
		if (v.consumptions.length > 0)
			consumptionDelete = consumptionDelete.not(
				'id',
				'in',
				`(${v.consumptions.map((usage) => usage.id).join(',')})`
			);
		check((await consumptionDelete).error);
	}
	async saveSession(v: CookingSession) {
		check(
			(
				await this.client
					.from('cooking_sessions')
					.update({
						prep_progress: v.prepProgress,
						step_progress: v.stepProgress,
						completed_at: v.completedAt
					})
					.eq('id', v.id)
			).error
		);
	}
	async saveNote(v: RecipeNote) {
		check((await this.client.from('recipe_notes').update({ content: v.content }).eq('id', v.id)).error);
	}
	async saveShoppingList(v: ShoppingList) {
		check(
			(
				await this.client
					.from('shopping_lists')
					.update({
						title: v.title,
						start_date: v.startDate || null,
						end_date: v.endDate || null,
						completed_at: v.checkedOutAt
					})
					.eq('id', v.id)
			).error
		);
	}
	async createShoppingList(v: ShoppingList) {
		check(
			(
				await this.client.from('shopping_lists').insert({
					id: v.id,
					user_id: this.userId,
					title: v.title,
					start_date: v.startDate || null,
					end_date: v.endDate || null
				})
			).error
		);
	}
	async saveShoppingItem(v: ShoppingItem) {
		check(
			(
				await this.client.from('shopping_items').upsert({
					id: v.id,
					user_id: this.userId,
					list_id: v.listId,
					name: v.name,
					quantity: v.quantity || null,
					note: v.note || null,
					category: v.category,
					position: v.position,
					is_checked: v.isChecked,
					added_to_inventory: v.addedToInventory,
					inventory_tracking_type: v.inventoryTrackingType,
					inventory_quantity: v.inventoryQuantity,
					inventory_unit: v.inventoryUnit,
					inventory_location: v.inventoryLocation,
					remember_for_next: v.rememberForNext
				})
			).error
		);
	}
	async deleteShoppingItem(id: string) {
		check((await this.client.from('shopping_items').delete().eq('id', id)).error);
	}
	async saveInventoryItem(v: InventoryItem) {
		check(
			(
				await this.client.from('inventory_items').upsert({
					id: v.id,
					user_id: this.userId,
					name: v.name,
					tracking_type: v.trackingType,
					quantity: v.quantity,
					unit: v.unit || null,
					location: v.location,
					status: v.status,
					best_before: v.bestBefore || null,
					note: v.note || null
				})
			).error
		);
	}
	async deleteInventoryItem(id: string) {
		check((await this.client.from('inventory_items').delete().eq('id', id)).error);
	}
	async checkoutShoppingList(id: string) {
		check((await this.client.rpc('checkout_shopping_list', { p_list_id: id })).error);
	}
	async completeCooking(sessionId: string) {
		check((await this.client.rpc('complete_cooking_session', { p_session_id: sessionId })).error);
	}
	async archiveRecipe(id: string) {
		check(
			(
				await this.client
					.from('recipes')
					.update({ status: 'archived', archived_at: new Date().toISOString() })
					.eq('id', id)
					.eq('status', 'active')
			).error
		);
	}
	async completeRecipe(id: string) {
		const session = await this.client
			.from('cooking_sessions')
			.select('id')
			.eq('recipe_id', id)
			.is('completed_at', null)
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		check(session.error);
		if (!session.data) throw new Error('Keine offene Koch-Session gefunden.');
		await this.completeCooking(session.data.id);
	}
}
