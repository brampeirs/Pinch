import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NewRecipeChooserPage } from './new-recipe-chooser';

describe('NewRecipeChooserPage', () => {
    let fixture: ComponentFixture<NewRecipeChooserPage>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NewRecipeChooserPage],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(NewRecipeChooserPage);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    it('shows the three recipe entry options and routes write or paste to the manual editor', () => {
        const element = fixture.nativeElement as HTMLElement;
        const text = element.textContent ?? '';

        expect(text).toContain('How would you like to add a recipe?');
        expect(text).toContain('Upload photos');
        expect(text).toContain('Import from link');
        expect(text).toContain('Write or paste');
        expect(element.querySelectorAll('button[disabled]').length).toBe(2);
        expect(element.querySelector('a[href="/recipes/new/manual"]')).toBeTruthy();
    });
});