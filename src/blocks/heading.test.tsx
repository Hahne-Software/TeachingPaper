// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { headingBlockType } from './heading';

const { View, PropertiesView } = headingBlockType;

describe('Heading view', () => {
  it('shows the stored text', () => {
    render(
      <View
        data={{ text: 'Fractions', level: 1 }}
        autoFocus={false}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('Fractions')).toBeInTheDocument();
  });

  it('keeps the same element and focus when the Heading Level changes', () => {
    const onChange = () => {};
    const { rerender } = render(
      <View
        data={{ text: 'Fractions', level: 1 }}
        autoFocus
        onChange={onChange}
      />,
    );
    const heading = screen.getByRole('heading');
    expect(heading).toHaveFocus();

    rerender(
      <View
        data={{ text: 'Fractions', level: 2 }}
        autoFocus
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('heading')).toBe(heading);
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute('aria-level', '2');
  });
});

describe('Heading properties', () => {
  it('marks the current Heading Level and changes it on click', async () => {
    const onChange = vi.fn();
    render(
      <PropertiesView
        data={{ text: 'Fractions', level: 2 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: '3' }));

    expect(onChange).toHaveBeenCalledWith({ text: 'Fractions', level: 3 });
  });
});
