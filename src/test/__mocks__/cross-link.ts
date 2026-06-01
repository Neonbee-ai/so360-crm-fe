// Stub for @so360/cross-link — keeps the provider inert in tests
import React from 'react';
export const CrossLinkProvider = ({ children }: any) =>
  React.createElement(React.Fragment, null, children);
export const useCrossLink = () => ({ resolve: async () => [], navigate: () => {}, isModuleEnabled: () => true });
export const useCrossLinkOptional = () => null;
export const useResolvedLink = () => ({ status: 'idle', link: null });
export const getEntityMeta = () => undefined;
export const buildDeepLink = () => '';
export const ENTITY_REGISTRY = {};
