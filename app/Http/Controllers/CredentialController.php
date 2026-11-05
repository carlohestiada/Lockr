<?php

namespace App\Http\Controllers;

use App\Models\Credential;
use App\Models\CredentialAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CredentialController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Credential::class);

        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:255'],
            'favorite' => ['sometimes', 'boolean'],
            'folder' => ['sometimes', 'string', 'max:20'],
            'folder_id' => [
                'sometimes',
                'integer',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
            'sort' => ['sometimes', Rule::in(['updated', 'title', 'folder'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $request->user()->credentials()
            ->with('folder:id,name')
            ->select([
                'id',
                'user_id',
                'title',
                'username',
                'website_url',
                'folder_id',
                'is_favorite',
                'created_at',
                'updated_at',
            ]);

        match ($validated['sort'] ?? 'updated') {
            'title' => $query->orderBy('title')->orderByDesc('id'),
            'folder' => $query->orderBy('folder_id')->orderBy('title'),
            default => $query->orderByDesc('updated_at')->orderByDesc('id'),
        };

        if (isset($validated['search']) && $validated['search'] !== '') {
            $search = $validated['search'];
            $query->where(function ($query) use ($search) {
                $pattern = "%{$search}%";
                $query->whereRaw('LOWER(title) LIKE LOWER(?)', [$pattern])
                    ->orWhereRaw('LOWER(username) LIKE LOWER(?)', [$pattern])
                    ->orWhereRaw('LOWER(website_url) LIKE LOWER(?)', [$pattern]);
            });
        }

        if (isset($validated['favorite'])) {
            $query->where('is_favorite', $validated['favorite']);
        }

        if (isset($validated['folder_id'])) {
            $query->where('folder_id', $validated['folder_id']);
        } elseif (($validated['folder'] ?? null) === 'unfiled') {
            $query->whereNull('folder_id');
        } elseif (isset($validated['folder']) && $validated['folder'] !== 'all') {
            abort_unless(ctype_digit($validated['folder']), 422, 'The selected folder is invalid.');
            $folderId = (int) $validated['folder'];
            abort_unless(
                $request->user()->folders()->whereKey($folderId)->exists(),
                422,
                'The selected folder is invalid.'
            );
            $query->where('folder_id', $folderId);
        }

        return response()->json($query->paginate($validated['per_page'] ?? 20));
    }

    public function show(Request $request, Credential $credential)
    {
        Gate::authorize('view', $credential);

        return response()->json([
            'data' => [
                'id' => $credential->id,
                'title' => $credential->title,
                'username' => $credential->username,
                'website_url' => $credential->website_url,
                'folder_id' => $credential->folder_id,
                'is_favorite' => $credential->is_favorite,
                'created_at' => $credential->created_at,
                'updated_at' => $credential->updated_at,
            ],
        ]);
    }

    public function edit(Credential $credential)
    {
        Gate::authorize('view', $credential);

        return response()->json([
            'data' => [
                'id' => $credential->id,
                'title' => $credential->title,
                'username' => $credential->username,
                'website_url' => $credential->website_url,
                'notes' => $credential->notes,
                'folder_id' => $credential->folder_id,
                'is_favorite' => $credential->is_favorite,
            ],
        ])->header('Cache-Control', 'no-store, private');
    }

    public function reveal(Request $request, Credential $credential)
    {
        Gate::authorize('view', $credential);

        CredentialAuditLog::create([
            'user_id' => $request->user()->id,
            'credential_id' => $credential->id,
            'event' => 'revealed',
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 1000),
        ]);

        return response()->json([
            'password' => $credential->password,
        ])->header('Cache-Control', 'no-store, private');
    }

    public function bulk(Request $request)
    {
        Gate::authorize('viewAny', Credential::class);

        $validated = $request->validate([
            'action' => ['required', Rule::in(['move', 'favorite', 'delete'])],
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'distinct'],
            'folder_id' => [
                Rule::requiredIf(
                    fn () => $request->input('action') === 'move' && ! $request->exists('folder_id')
                ),
                'nullable',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
        ]);

        $ids = $validated['ids'];
        $query = $request->user()->credentials()->whereKey($ids);

        abort_unless($query->count() === count($ids), 403, 'One or more selected credentials are unavailable.');

        DB::transaction(function () use ($validated, $query) {
            match ($validated['action']) {
                'move' => $query->update(['folder_id' => $validated['folder_id']]),
                'favorite' => $query->update(['is_favorite' => true]),
                'delete' => $query->delete(),
            };
        });

        return response()->json(['message' => 'Bulk action completed.']);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Credential::class);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:10000'],
            'website_url' => ['nullable', 'url', 'max:2048'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'folder_id' => [
                'nullable',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
            'is_favorite' => ['sometimes', 'boolean'],
        ]);

        $credential = $request->user()
            ->credentials()
            ->create($validated);

        return response()->json($credential, 201);
    }

    public function update(Request $request, Credential $credential)
    {
        Gate::authorize('update', $credential);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'username' => ['sometimes', 'nullable', 'string', 'max:255'],
            'password' => ['sometimes', 'required', 'string', 'max:10000'],
            'website_url' => ['sometimes', 'nullable', 'url', 'max:2048'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'folder_id' => [
                'sometimes',
                'nullable',
                Rule::exists('folders', 'id')
                    ->where('user_id', $request->user()->id),
            ],
            'is_favorite' => ['sometimes', 'boolean'],
        ]);

        $credential->update($validated);

        return response()->json(['message' => 'Credential updated.']);
    }

    public function destroy(Credential $credential)
    {
        Gate::authorize('delete', $credential);

        $credential->delete();

        return response()->json(['message' => 'Credential deleted.']);
    }
}
