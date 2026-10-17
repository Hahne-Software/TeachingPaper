// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { headingBlockType } from './heading';

describe('Heading view', () => {
  it('shows the stored text', () => {
    const { View } = headingBlockType;

    render(
      <View
        data={{ text: 'Fractions', level: 1 }}
        autoFocus={false}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('Fractions')).toBeInTheDocument();
  });
});
