import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Recipe, RecipeCard } from '../../components/recipe-card/recipe-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, RecipeCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  recipes: Recipe[] = [
    {
      id: '1',
      title: 'Pasta Carbonara',
      description: 'Romige Italiaanse pasta met spek, ei en Parmezaanse kaas',
      imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
      category: 'Pasta',
      prepTime: 10,
      cookTime: 20,
    },
    {
      id: '2',
      title: 'Kip Teriyaki Bowl',
      description: 'Malse kip in zoete teriyakisaus met rijst en groenten',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
      category: 'Bowls',
      prepTime: 15,
      cookTime: 25,
    },
    {
      id: '3',
      title: 'Avocado Toast',
      description: 'Krokant brood met romige avocado en een gepocheerd ei',
      imageUrl: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800',
      category: 'Ontbijt',
      prepTime: 5,
      cookTime: 10,
    },
    {
      id: '4',
      title: 'Tom Kha Gai',
      description: 'Thaise kokossoep met kip, galanga en citroengras',
      imageUrl: 'https://images.unsplash.com/photo-1569562211093-4ed0d0758f12?w=800',
      category: 'Soepen',
      prepTime: 15,
      cookTime: 30,
    },
  ];

  categories = [
    { name: 'Pasta', slug: 'pasta', emoji: '🍝' },
    { name: 'Soepen', slug: 'soepen', emoji: '🍲' },
    { name: 'Salades', slug: 'salades', emoji: '🥗' },
    { name: 'Bowls', slug: 'bowls', emoji: '🍜' },
    { name: 'Desserts', slug: 'desserts', emoji: '🍰' },
    { name: 'Ontbijt', slug: 'ontbijt', emoji: '🍳' },
  ];
}
