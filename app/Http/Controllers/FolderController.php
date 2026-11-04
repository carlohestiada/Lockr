<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class FolderController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Folder::class);

        return response()->json(
            $request->user()->folders()->withCount('credentials')->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Folder::class);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('folders', 'name')
                    ->where('user_id', $request->user()->id),
            ],
        ]);

        $folder = $request->user()->folders()->create($validated);

        return response()->json($folder, 201);
    }

    public function update(Request $request, Folder $folder)
    {
        Gate::authorize('update', $folder);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('folders', 'name')
                    ->where('user_id', $request->user()->id)
                    ->ignore($folder->id),
            ],
        ]);

        $folder->update($validated);

        return response()->json(['message' => 'Folder updated.']);
    }

    public function destroy(Folder $folder)
    {
        Gate::authorize('delete', $folder);

        $folder->delete();

        return response()->json(['message' => 'Folder deleted.']);
    }
}
