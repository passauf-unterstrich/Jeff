import type { AppData, BasicStatus, InventoryItem, Location, ShoppingCategory } from './types';

const id = () => crypto.randomUUID();

export function createSeedData(): AppData {
	const recipeId = id();
	const listId = id();
	const prep = [
		'100 g Basmati-Reis abwiegen und gründlich waschen',
		'½ Gurke längs halbieren und in dünne Halbmonde schneiden',
		'1 Karotte schälen und in feine Stifte schneiden',
		'2 cm Ingwer fein reiben; 2 Frühlingszwiebeln in Weiß und Grün trennen',
		'2 EL Sojasauce mit 2 EL Wasser verrühren; 1 Limette halbieren',
		'1 TL Sesam in der trockenen Pfanne goldbraun rösten und herausnehmen',
		'180 g Rinderhack aus dem Kühlschrank nehmen und trocken tupfen'
	].map((text, position) => ({ id: id(), recipeId, position, text }));
	const stepData = [
		[
			'Reis ruhig und locker garen',
			'Wasche den Reis in einer Schüssel drei- bis viermal mit kaltem Wasser: mit der Hand bewegen, trübes Wasser abgießen, wiederholen, bis es nur noch leicht milchig ist. Gut abtropfen lassen, dann mit 150 ml kaltem Wasser und einer kräftigen Prise Salz in den kleinsten Topf geben. Einmal offen aufkochen. Sobald die ganze Oberfläche blubbert, Deckel auflegen und sofort auf die kleinste Platte bei niedrigster Stufe ziehen. 11 Minuten nicht öffnen und nicht rühren. Platte ausschalten, weitere 5 Minuten geschlossen ruhen lassen; erst ganz am Ende mit einer Gabel auflockern.',
			'16 Min.',
			'Erst hoch, dann kleinste Hitze',
			'Kein Wasser mehr sichtbar; Körner locker, nicht nass'
		],
		[
			'Gurke und Karotte schnell säuern',
			'Gib Gurke und Karotte in eine Schüssel. Presse zuerst eine halbe Limette darüber, gib zwei kleine Prisen Salz und optional eine winzige Prise Zucker dazu. Mische 20 Sekunden mit den Händen und drücke das Gemüse dabei nur leicht – es soll Geschmack annehmen, aber knackig bleiben. Probiere nach 3 Minuten: Es soll zuerst frisch-säuerlich, dann leicht salzig schmecken. Ist es nur sauer, fehlt eine Prise Salz; wirkt es flach, helfen wenige weitere Tropfen Limette. Lass das Gemüse stehen und gieße die entstandene Flüssigkeit erst direkt vor dem Anrichten ab.',
			'5 Min.',
			'Kalt, ohne Herd',
			'Knackig und klar säuerlich, nicht weich oder wässrig'
		],
		[
			'Rinderhack wirklich bräunen',
			'Nimm die größte Pfanne und heize sie auf deiner stärkeren Platte 2–3 Minuten leer auf höchster Stufe vor. Die Pfanne ist bereit, wenn ein einzelner Wassertropfen sofort zischt und verdampft. Gib das trockene Hack in einer flachen Lage hinein und drücke es einmal an. Jetzt 2 Minuten überhaupt nicht bewegen: Nur so entsteht statt grauem, gekochtem Fleisch eine dunkle Kruste. Drehe große Stücke um und lasse sie weitere 60–90 Sekunden bräunen. Erst dann mit dem Pfannenwender grob zerteilen. Sammelt sich Wasser, breite das Fleisch weiter aus und warte mit allem anderen, bis die Flüssigkeit vollständig verkocht ist.',
			'4–5 Min.',
			'Höchste Stufe',
			'Dunkelbraune Stellen und nussiger Duft; kein grauer Fleischsaft'
		],
		[
			'Aus dem Bratensatz eine Glasur bauen',
			'Schiebe das gebräunte Fleisch an den Pfannenrand. Gib Ingwer und das Weiße der Frühlingszwiebeln auf die freie heiße Stelle und rühre dort nur 20–30 Sekunden, bis es duftet – Ingwer darf nicht dunkel werden. Gieße die Mischung aus Sojasauce und Wasser an den Pfannenrand. Sie soll sofort kräftig zischen. Löse mit dem Pfannenwender alle braunen Stellen vom Boden; genau dieser Bratensatz macht die Sauce tief und rund. Vermische alles und koche 30–60 Sekunden weiter, bis fast keine freie Flüssigkeit mehr da ist und jedes Fleischstück dünn glänzt. Pfanne vom Herd nehmen und erst jetzt 1–2 TL Limettensaft einrühren. Probiere: kräftig und glänzend, aber nicht salzig-suppig.',
			'2 Min.',
			'Mittel bis hoch, dann vom Herd',
			'Dünne glänzende Schicht am Fleisch; Pfannenboden fast trocken'
		],
		[
			'Die Bowl mit Kontrast anrichten',
			'Lockere den Reis mit einer Gabel vom Rand zur Mitte auf, ohne ihn zu zerdrücken, und gib ihn auf eine Seite einer warmen Schale. Setze das glasierte Beef daneben statt darüber, damit der Reis locker bleibt. Gieße die Gurken-Karotten-Flüssigkeit ab und lege das Gemüse als kühlen, knackigen Gegenpol in die freie Ecke. Streue Sesam und das grüne Frühlingszwiebelgrün gezielt über das Fleisch. Gib zum Schluss einen kleinen Limettenschnitz dazu. Nimm den ersten Bissen mit Reis, Beef und Gemüse zusammen; fehlt Frische, presse erst dann noch etwas Limette darüber.',
			'2 Min.',
			'Ohne Hitze',
			'Warm, kühl, weich und knackig in jedem zusammengesetzten Bissen'
		]
	];
	const steps = stepData.map(([title, instruction, duration, temperature, goal], position) => ({
		id: id(),
		recipeId,
		position,
		title,
		instruction,
		duration,
		temperature,
		goal
	}));
	const inventorySeed: Array<
		[string, 'exact' | 'basic', number | null, string, Location, BasicStatus, string?]
	> = [
		['Basmati-Reis', 'basic', null, '', 'Vorratsschrank', 'vorhanden'],
		['Eier', 'exact', 6, 'Stück', 'Kühlschrank', 'vorhanden'],
		['Parmesan', 'basic', null, '', 'Kühlschrank', 'vorhanden'],
		['Butter', 'basic', null, '', 'Kühlschrank', 'vorhanden'],
		['Hähnchenbrust, gefroren', 'exact', 1, 'Portion', 'Gefrierfach', 'vorhanden'],
		['Gyoza', 'exact', 2, 'Packungen', 'Gefrierfach', 'vorhanden'],
		['Sauerteigbrot', 'exact', 10, 'Scheiben', 'Gefrierfach', 'vorhanden'],
		['Zwiebeln', 'exact', 3, 'Stück', 'Vorratsschrank', 'vorhanden'],
		['Knoblauch', 'exact', 1, 'Knolle', 'Vorratsschrank', 'vorhanden'],
		['Bananen', 'exact', 3, 'Stück', 'Arbeitsfläche', 'vorhanden'],
		['Sojasauce', 'basic', null, '', 'Vorratsschrank', 'wenig'],
		['Olivenöl', 'basic', null, '', 'Vorratsschrank', 'vorhanden'],
		['Gewürze', 'basic', null, '', 'Vorratsschrank', 'vorhanden']
	];
	const inventory: InventoryItem[] = inventorySeed.map(
		([name, trackingType, quantity, unit, location, status, bestBefore = '']) => ({
			id: id(),
			name,
			trackingType,
			quantity,
			unit,
			location,
			status,
			bestBefore,
			note: ''
		})
	);
	const shoppingSeed: Array<[string, string, ShoppingCategory, string?]> = [
		['Gurke', '1', 'Gemüse & Obst'],
		['Karotten', '2', 'Gemüse & Obst'],
		['Ingwer', '1 Stück', 'Gemüse & Obst'],
		['Frühlingszwiebeln', '1 Bund', 'Gemüse & Obst'],
		['Limetten', '2', 'Gemüse & Obst'],
		['Sesam', '1 Packung', 'Brot, Trockenware & Saucen'],
		['Rinderhack', '180 g', 'Fleischtheke & Käse', 'möglichst frisch']
	];

	return {
		recipe: {
			id: recipeId,
			title: 'Ginger-Beef-Rice-Bowl',
			cookDate: new Date().toISOString().slice(0, 10),
			servings: 1,
			learningFocus: 'Pfannenglasur und schnelle Säure',
			prepItems: prep,
			steps
		},
		session: { id: id(), recipeId, prepProgress: {}, stepProgress: {}, completedAt: null },
		note: { id: id(), recipeId, content: '' },
		shoppingList: { id: listId, title: 'Einkauf für Do–So', startDate: '', endDate: '' },
		shoppingItems: shoppingSeed.map(([name, quantity, category, note = ''], position) => ({
			id: id(),
			listId,
			name,
			quantity,
			category,
			note,
			position,
			isChecked: false
		})),
		inventory
	};
}
