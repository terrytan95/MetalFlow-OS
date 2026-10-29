import React from 'react';
export function Button({children,primary=false,disabled=false,onClick}){return <button className={primary?'primary':''} disabled={disabled} onClick={onClick}>{children}</button>;}
