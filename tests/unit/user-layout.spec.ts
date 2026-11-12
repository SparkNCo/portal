import { test, expect } from '@playwright/test';
import { expandedPanelKey, moveNavKey, orderNavItems, setPanelExpanded } from '../../lib/user-layout';

const items = ['dashboard', 'monitor', 'build', 'bugs', 'settings'].map((href) => ({ href }));
const keys = (list: { href: string }[]) => list.map((i) => i.href);

test.describe('sidebar order (SPA-581)', () => {
  test('nothing saved: the default order', () => {
    expect(keys(orderNavItems(items, null))).toEqual(['dashboard', 'monitor', 'build', 'bugs', 'settings']);
    expect(keys(orderNavItems(items, []))).toEqual(['dashboard', 'monitor', 'build', 'bugs', 'settings']);
  });

  test('the saved order wins', () => {
    expect(keys(orderNavItems(items, ['build', 'dashboard', 'settings', 'monitor', 'bugs'])))
      .toEqual(['build', 'dashboard', 'settings', 'monitor', 'bugs']);
  });

  test('pages missing from the saved order keep their default order after it', () => {
    expect(keys(orderNavItems(items, ['bugs', 'build']))).toEqual(['bugs', 'build', 'dashboard', 'monitor', 'settings']);
  });

  test('saved pages this user does not have are ignored, and repeats count once', () => {
    expect(keys(orderNavItems(items, ['query', 'bugs', 'bugs', 'developer']))).toEqual(['bugs', 'dashboard', 'monitor', 'build', 'settings']);
  });

  test('moving an item onto another takes its place', () => {
    const order = keys(items);
    expect(moveNavKey(order, 'settings', 'dashboard')).toEqual(['settings', 'dashboard', 'monitor', 'build', 'bugs']);
    expect(moveNavKey(order, 'dashboard', 'build')).toEqual(['monitor', 'build', 'dashboard', 'bugs', 'settings']);
  });

  test('a move with an unknown or same item changes nothing', () => {
    const order = keys(items);
    expect(moveNavKey(order, 'query', 'build')).toBe(order);
    expect(moveNavKey(order, 'build', 'build')).toBe(order);
  });
});

test.describe('widened panels on pages other than the Dashboard', () => {
  test('kept per page', () => {
    expect(expandedPanelKey('build', 'build_backlog')).toBe('build:build_backlog');
  });

  test('widening adds it once; shrinking removes it; others stay', () => {
    const key = expandedPanelKey('build', 'build_done');
    const widened = setPanelExpanded(['monitor:software_kpis'], key, true);
    expect(widened).toEqual(['monitor:software_kpis', key]);
    expect(setPanelExpanded(widened, key, true)).toEqual(['monitor:software_kpis', key]);
    expect(setPanelExpanded(widened, key, false)).toEqual(['monitor:software_kpis']);
  });
});
