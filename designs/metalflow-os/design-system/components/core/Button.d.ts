import type { ReactNode } from 'react';
export interface ButtonProps { children:ReactNode;primary?:boolean;disabled?:boolean;onClick?:()=>void }
export declare function Button(props:ButtonProps):ReactNode;
