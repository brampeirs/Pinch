import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  isSearchOpen = signal(false);
  isMenuOpen = signal(false);

  toggleSearch() {
    this.isSearchOpen.update((v) => !v);
  }

  toggleMenu() {
    this.isMenuOpen.update((v) => !v);
  }
}
