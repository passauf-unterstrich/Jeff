export const SHOPPING_CATEGORIES = [
	'Gemüse & Obst',
	'Brot, Trockenware & Saucen',
	'Kühlregal',
	'Fleischtheke & Käse',
	'Tiefkühl',
	'Getränke & Snacks',
	'Küchenabteilung'
] as const;

export const LOCATIONS = ['Kühlschrank', 'Gefrierfach', 'Vorratsschrank', 'Arbeitsfläche'] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];
export type Location = (typeof LOCATIONS)[number];
export type TrackingType = 'exact' | 'basic';
export type BasicStatus = 'vorhanden' | 'wenig' | 'leer';

export type PrepItem = { id: string; recipeId: string; position: number; text: string };
export type RecipeStep = {
	id: string;
	recipeId: string;
	position: number;
	title: string;
	instruction: string;
	duration?: string;
	temperature?: string;
	goal?: string;
};
export type Recipe = {
	id: string;
	title: string;
	cookDate: string;
	servings: number;
	learningFocus: string;
	prepItems: PrepItem[];
	steps: RecipeStep[];
};
export type CookingSession = {
	id: string;
	recipeId: string;
	prepProgress: Record<string, boolean>;
	stepProgress: Record<string, boolean>;
	completedAt: string | null;
};
export type RecipeNote = { id: string; recipeId: string; content: string };
export type ShoppingList = { id: string; title: string; startDate: string; endDate: string };
export type ShoppingItem = {
	id: string;
	listId: string;
	name: string;
	quantity: string;
	note: string;
	category: ShoppingCategory;
	position: number;
	isChecked: boolean;
};
export type InventoryItem = {
	id: string;
	name: string;
	trackingType: TrackingType;
	quantity: number | null;
	unit: string;
	location: Location;
	status: BasicStatus;
	bestBefore: string;
	note: string;
};
export type AppData = {
	recipe: Recipe;
	session: CookingSession;
	note: RecipeNote;
	shoppingList: ShoppingList;
	shoppingItems: ShoppingItem[];
	inventory: InventoryItem[];
};
