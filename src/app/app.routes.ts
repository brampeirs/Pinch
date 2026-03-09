import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { RecipeDetailPage } from './pages/recipe-detail/recipe-detail';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'recipes/:id', component: RecipeDetailPage },
  { path: '**', redirectTo: '' },
];
