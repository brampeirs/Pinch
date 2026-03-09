import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './components/header/header';
import { AiChat } from './components/ai-chat/ai-chat';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, AiChat],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
