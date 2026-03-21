/// <reference types="vite/client" />

import type * as ReactTypes from 'react'

declare global {
  namespace React {
    export import JSX = ReactTypes.JSX
    export type ReactNode = ReactTypes.ReactNode
    export type MouseEvent<T = Element> = ReactTypes.MouseEvent<T>
    export type RefObject<T> = ReactTypes.RefObject<T>
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    export type ComponentType<P = {}> = ReactTypes.ComponentType<P>
    export type ComponentProps<T extends ReactTypes.ElementType> = ReactTypes.ComponentProps<T>
    export type ButtonHTMLAttributes<T> = ReactTypes.ButtonHTMLAttributes<T>
    export type HTMLAttributes<T> = ReactTypes.HTMLAttributes<T>
    export type DetailedHTMLProps<
      E extends ReactTypes.HTMLAttributes<T>,
      T
    > = ReactTypes.DetailedHTMLProps<E, T>
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: ReactTypes.DetailedHTMLProps<
        ReactTypes.HTMLAttributes<HTMLElement> & {
          src?: string
          partition?: string
          allowpopups?: string
          preload?: string
          nodeintegration?: string
        },
        HTMLElement
      >
    }
  }
}

export {}
