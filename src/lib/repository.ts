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
	load(): Promise<AppData>;
	saveRecipe(value: Recipe): Promise<void>;
	saveSession(value: CookingSession): Promise<void>;
	saveNote(value: RecipeNote): Promise<void>;
	saveShoppingList(value: ShoppingList): Promise<void>;
	saveShoppingItem(value: ShoppingItem): Promise<void>;
	deleteShoppingItem(id: string): Promise<void>;
	saveInventoryItem(value: InventoryItem): Promise<void>;
	deleteInventoryItem(id: string): Promise<void>;
}

const STORAGE_KEY = 'jeff-demo-data-v4';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class DemoRepository implements Repository {
	private data!: AppData;
	async load() {
		const stored = localStorage.getItem(STORAGE_KEY);
		this.data = stored ? JSON.parse(stored) : createSeedData();
		this.flush();
		return clone(this.data);
	}
	private flush() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
	}
	async saveRecipe(value: Recipe) {
		this.data.recipe = clone(value);
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
}

const check = (error: { message: string } | null) => {
	if (error) throw new Error(error.message);
};

export class SupabaseRepository implements Repository {
	constructor(
		private client: SupabaseClient,
		private userId: string
	) {}

	async load(): Promise<AppData> {
		const { data: recipeRow, error } = await this.client
			.from('recipes')
			.select('*')
			.order('cook_date', { ascending: false })
			.limit(1)
			.maybeSingle();
		check(error);
		if (!recipeRow) {
			await this.seed();
			return this.load();
		}
		const recipeId = recipeRow.id;
		const [prep, steps, sessions, notes, lists, inventory] = await Promise.all([
			this.client.from('recipe_prep_items').select('*').eq('recipe_id', recipeId).order('position'),
			this.client.from('recipe_steps').select('*').eq('recipe_id', recipeId).order('position'),
			this.client
				.from('cooking_sessions')
				.select('*')
				.eq('recipe_id', recipeId)
				.order('created_at', { ascending: false })
				.limit(1),
			this.client.from('recipe_notes').select('*').eq('recipe_id', recipeId).limit(1),
			this.client.from('shopping_lists').select('*').order('created_at', { ascending: false }).limit(1),
			this.client.from('inventory_items').select('*').order('name')
		]);
		for (const result of [prep, steps, sessions, notes, lists, inventory]) check(result.error);
		const listRow = lists.data![0];
		const shopping = await this.client
			.from('shopping_items')
			.select('*')
			.eq('list_id', listRow.id)
			.order('position');
		check(shopping.error);
		const sessionRow = sessions.data![0];
		const noteRow = notes.data![0];
		return {
			recipe: {
				id: recipeRow.id,
				title: recipeRow.title,
				cookDate: recipeRow.cook_date ?? '',
				servings: recipeRow.servings,
				learningFocus: recipeRow.learning_focus ?? '',
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
					goal: r.goal ?? ''
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
				endDate: listRow.end_date ?? ''
			},
			shoppingItems: shopping.data!.map((r) => ({
				id: r.id,
				listId: r.list_id,
				name: r.name,
				quantity: r.quantity ?? '',
				note: r.note ?? '',
				category: r.category,
				position: r.position,
				isChecked: r.is_checked
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
			}))
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
					learning_focus: d.recipe.learningFocus
				})
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
						goal: x.goal || null
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
				await this.client
					.from('shopping_lists')
					.insert({ id: d.shoppingList.id, user_id: this.userId, title: d.shoppingList.title })
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
						is_checked: false
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
						learning_focus: v.learningFocus
					})
					.eq('id', v.id)
			).error
		);
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
						goal: step.goal || null
					}))
				)
			).error
		);
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
					.update({ title: v.title, start_date: v.startDate || null, end_date: v.endDate || null })
					.eq('id', v.id)
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
					is_checked: v.isChecked
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
}
