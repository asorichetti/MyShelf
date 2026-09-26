package journeys

import (
	"sort"
	"testing"
)

func TestRegistryIsSortedAndComplete(t *testing.T) {
	all := All()
	if len(all) == 0 {
		t.Fatal("no journeys registered")
	}
	if !sort.SliceIsSorted(all, func(a, b int) bool { return all[a].Name < all[b].Name }) {
		t.Error("All() must be sorted by name")
	}
	core := 0
	for _, j := range all {
		if j.Suite == "core" {
			core++
		}
	}
	if core == 0 {
		t.Error("smoke runs the core suite; it must not be empty")
	}
}

func TestRegisterPanicsOnDuplicate(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("registering a duplicate name must panic")
		}
	}()
	register(All()[0])
}

func TestExpect(t *testing.T) {
	if expect(true, "x") != nil {
		t.Error("expect(true) must be nil")
	}
	err := expect(false, "/: expected h1 %q, found %q", "MyShelf", "MyShelff")
	if err == nil || err.Error() != `/: expected h1 "MyShelf", found "MyShelff"` {
		t.Errorf("unexpected message: %v", err)
	}
}
