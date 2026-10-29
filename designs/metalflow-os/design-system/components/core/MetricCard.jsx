import React from 'react';
export function MetricCard({label,value,note}){return <article className="card"><small>{label}</small><strong>{value}</strong><small>{note}</small></article>;}
