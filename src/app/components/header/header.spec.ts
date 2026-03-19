import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Header } from './header';
import { ChatViewModeService } from '../../services/chat-view-mode.service';

describe('Header', () => {
    let fixture: ComponentFixture<Header>;
    let chatViewModeService: ChatViewModeService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [Header],
            providers: [provideRouter([]), ChatViewModeService],
        }).compileComponents();

        fixture = TestBed.createComponent(Header);
        chatViewModeService = TestBed.inject(ChatViewModeService);
        fixture.detectChanges();
    });

    it('toggles the AI chat when the Ask AI button is clicked twice', () => {
        const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
        const askAiButton = buttons.find((button) => button.textContent?.includes('Ask AI'));

        expect(askAiButton).toBeTruthy();
        expect(chatViewModeService.isOpen()).toBe(false);

        askAiButton?.click();
        fixture.detectChanges();

        expect(chatViewModeService.isOpen()).toBe(true);

        askAiButton?.click();
        fixture.detectChanges();

        expect(chatViewModeService.isOpen()).toBe(false);
    });
});