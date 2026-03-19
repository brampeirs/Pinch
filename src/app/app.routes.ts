import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RecipeDetailPage } from './pages/recipe-detail/recipe-detail';
import { AddRecipePage } from './pages/add-recipe/add-recipe';
import { NewRecipeChooserPage } from './pages/new-recipe-chooser/new-recipe-chooser';
import { RecipesPage } from './pages/recipes/recipes';

export const routes: Routes = [
    { path: '', component: Home },
    { path: 'recipes/new', component: NewRecipeChooserPage },
    { path: 'recipes/new/manual', component: AddRecipePage },
    { path: 'recipes/:id/edit', component: AddRecipePage },
    { path: 'recipes/:id', component: RecipeDetailPage },
    { path: 'recipes', component: RecipesPage, pathMatch: 'full' },
    { path: '**', redirectTo: '' },
];
