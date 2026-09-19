(function(a){let l=a[0],r=a[1];Pip.onExclusive("knob1",l);try{Pip.onExclusive("knob2",r)}catch(e){Pip.removeListener("knob1",l);throw e}return 1})
