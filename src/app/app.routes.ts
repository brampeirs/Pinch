import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RecipeDetailPage } from './pages/recipe-detail/recipe-detail';
import { AddRecipePage } from './pages/add-recipe/add-recipe';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'recipes/new', component: AddRecipePage },
  { path: 'recipes/:id/edit', component: AddRecipePage },
  { path: 'recipes/:id', component: RecipeDetailPage },
  { path: '**', redirectTo: '' },
];
