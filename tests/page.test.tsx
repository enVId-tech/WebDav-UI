import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import HomePage from "@/app/page"

// Use a mock useRouter to avoid 'invarient expected app router to be mounted' error
jest.mock('next/navigation', () => ({
    useRouter() {
        return {
            push: jest.fn(),
            prefetch: jest.fn()
        }
    }
}))

// Define the matchMedia property to prevent 'window.matchMedia is not a function' errors
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Checks if the main UI components are loaded and rendered in properly
describe('HomePage', () => {
    const { getByPlaceholderText, getByText } = render(<HomePage />);

    // Checks if there is a text input in the document
    test('Should have a text input', () => {
        const inputElement: HTMLInputElement = getByPlaceholderText('Enter share name') as HTMLInputElement;

        expect(inputElement).toBeInTheDocument();
    })

    // Checks if text input can have a value
    // Inputs 'tests' share for default text
    test('Should input value into text input', () => {
        const inputElement: HTMLInputElement = getByPlaceholderText('Enter share name') as HTMLInputElement;

        fireEvent.change(inputElement, { target: { value: 'tests'}})

        expect(inputElement.value).toBe('tests');
    })

    // Checks if button is clickable
    // Clicks button and expects a clicked value
    test('Redirect button should redirect on text input', () => {
        const buttonElement = screen.getByText("Access Files");

        fireEvent.click(buttonElement);

        expect(buttonElement).toHaveBeenCalledTimes(1);
    })
})