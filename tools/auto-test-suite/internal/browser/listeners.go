package browser

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/mxschmitt/playwright-go"
)

// ConsoleEntry is one console message or uncaught page error.
type ConsoleEntry struct {
	Time     time.Time `json:"time"`
	Type     string    `json:"type"` // log, warning, error, ..., or "pageerror"
	Text     string    `json:"text"`
	Location string    `json:"location,omitempty"`
	IsError  bool      `json:"isError"`
}

// NetworkEntry is a failed request: a response with status >= 400, or a
// request that never got a response (Status 0 plus the failure text).
type NetworkEntry struct {
	Time         time.Time `json:"time"`
	URL          string    `json:"url"`
	Method       string    `json:"method"`
	Status       int       `json:"status"`
	StatusText   string    `json:"statusText,omitempty"`
	ResourceType string    `json:"resourceType,omitempty"`
	Failure      string    `json:"failure,omitempty"`
}

// Listeners records console output, page errors and failed network traffic.
// Successful traffic is dropped on purpose: a list of only failures is
// something a human will actually open.
type Listeners struct {
	mu      sync.Mutex
	console []ConsoleEntry
	network []NetworkEntry
}

// Attach wires the listeners onto a page. Call it before navigating; anything
// that fires before Attach returns is lost.
func Attach(page playwright.Page) *Listeners {
	l := &Listeners{}
	page.OnConsole(func(m playwright.ConsoleMessage) {
		e := ConsoleEntry{Time: time.Now(), Type: m.Type(), Text: m.Text(), IsError: m.Type() == "error"}
		if loc := m.Location(); loc != nil && loc.URL != "" {
			e.Location = fmt.Sprintf("%s:%d:%d", loc.URL, loc.Line+1, loc.Column+1)
		}
		l.addConsole(e)
	})
	page.OnPageError(func(err error) {
		l.addConsole(ConsoleEntry{Time: time.Now(), Type: "pageerror", Text: err.Error(), IsError: true})
	})
	page.OnResponse(func(r playwright.Response) {
		if r.Status() < 400 {
			return
		}
		e := NetworkEntry{Time: time.Now(), URL: r.URL(), Status: r.Status(), StatusText: r.StatusText()}
		if req := r.Request(); req != nil {
			e.Method = req.Method()
			e.ResourceType = req.ResourceType()
		}
		l.addNetwork(e)
	})
	page.OnRequestFailed(func(r playwright.Request) {
		e := NetworkEntry{Time: time.Now(), URL: r.URL(), Method: r.Method(), ResourceType: r.ResourceType()}
		if err := r.Failure(); err != nil {
			e.Failure = err.Error()
		}
		l.addNetwork(e)
	})
	return l
}

func (l *Listeners) addConsole(e ConsoleEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.console = append(l.console, e)
}

func (l *Listeners) addNetwork(e NetworkEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.network = append(l.network, e)
}

// Snapshot returns copies, so gates can read without draining what the JSON
// dump will later write.
func (l *Listeners) Snapshot() ([]ConsoleEntry, []NetworkEntry) {
	if l == nil {
		return nil, nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	c := append([]ConsoleEntry(nil), l.console...)
	n := append([]NetworkEntry(nil), l.network...)
	return c, n
}

// WriteJSON writes console.json and network.json into dir.
func (l *Listeners) WriteJSON(dir string) (consolePath, networkPath string, err error) {
	c, n := l.Snapshot()
	if c == nil {
		c = []ConsoleEntry{}
	}
	if n == nil {
		n = []NetworkEntry{}
	}
	consolePath = dir + string(os.PathSeparator) + "console.json"
	networkPath = dir + string(os.PathSeparator) + "network.json"
	if err := WriteJSONFile(consolePath, c); err != nil {
		return "", "", err
	}
	if err := WriteJSONFile(networkPath, n); err != nil {
		return "", "", err
	}
	return consolePath, networkPath, nil
}

// WriteJSONFile writes v as indented JSON and surfaces the Close error, which on
// some filesystems is the first sign the write never reached disk.
func WriteJSONFile(path string, v any) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	defer func() {
		if cerr := f.Close(); cerr != nil && err == nil {
			err = fmt.Errorf("close %s: %w", path, cerr)
		}
	}()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return fmt.Errorf("encode %s: %w", path, err)
	}
	return nil
}
