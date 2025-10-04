import React from 'react';

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { err: any; info?: { componentStack?: string } | null }
> {
  constructor(props: any){ super(props); this.state = { err: null, info: null }; }
  static getDerivedStateFromError(err: any){ return { err, info: null }; }
  componentDidCatch(err: any, info: { componentStack?: string }){ this.setState({ err, info }); try{ console.error(err, info);}catch{} }
  render(){
    if (this.state.err){
      return (
        <div className="max-w-3xl mx-auto p-4">
          <h2 className="text-lg font-semibold mb-2">Something crashed</h2>
          <pre className="text-xs bg-black text-white p-3 rounded overflow-auto" style={{whiteSpace:'pre-wrap'}}>
            {(this.state.err?.stack || String(this.state.err)) + '\n' + (this.state.info?.componentStack || '')}
          </pre>
          <button className="mt-3 px-3 py-2 rounded border" onClick={()=>location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
