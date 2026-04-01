<?php

namespace App\Services;

use App\Models\MetradoSanitariasNode;
use App\Models\MetradoSanitariasValue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\Collection;

class TreeService
{
    /**
     * Get the complete tree structure for a project.
     * 
     * @param int $projectId
     * @return array
     */
    public function getTree(int $projectId): array
    {
        try {
            // Get all nodes for the project with their values
            $nodes = MetradoSanitariasNode::where('project_id', $projectId)
                ->with(['values.module'])
                ->orderBy('position')
                ->get();

            // Build hierarchical structure
            return $this->buildHierarchy($nodes);
        } catch (\Exception $e) {
            Log::error('TreeService: Failed to get tree', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Create a new node in the tree.
     * 
     * @param int $projectId
     * @param array $data
     * @return MetradoSanitariasNode
     * @throws \InvalidArgumentException
     */
    public function createNode(int $projectId, array $data): MetradoSanitariasNode
    {
        return DB::transaction(function () use ($projectId, $data) {
            // Validate node type
            $this->validateNodeType($data['node_type'] ?? null);

            // Validate hierarchy rules
            if (isset($data['parent_id'])) {
                $this->validateHierarchy($data['parent_id'], $data['node_type']);
            }

            // Calculate level based on parent
            $level = $this->calculateLevel($data['parent_id'] ?? null);

            // Calculate position (append to end of siblings)
            $position = $this->calculateNextPosition($projectId, $data['parent_id'] ?? null);

            // Create the node
            $node = MetradoSanitariasNode::create([
                'project_id' => $projectId,
                'parent_id' => $data['parent_id'] ?? null,
                'node_type' => $data['node_type'],
                'name' => $data['name'],
                'numbering' => $data['numbering'] ?? null,
                'unit' => $data['unit'] ?? null,
                'level' => $level,
                'position' => $position,
            ]);

            // Create values for modules if provided
            if (isset($data['values']) && is_array($data['values'])) {
                $this->createNodeValues($node->id, $data['values']);
            }

            Log::info('TreeService: Node created', [
                'node_id' => $node->id,
                'project_id' => $projectId,
                'node_type' => $node->node_type,
            ]);

            // Reload with relationships
            return $node->load(['values.module', 'children']);
        });
    }

    /**
     * Update an existing node.
     * 
     * @param string $nodeId
     * @param array $data
     * @return MetradoSanitariasNode
     * @throws \InvalidArgumentException
     */
    public function updateNode(string $nodeId, array $data): MetradoSanitariasNode
    {
        return DB::transaction(function () use ($nodeId, $data) {
            $node = MetradoSanitariasNode::findOrFail($nodeId);

            // Validate node type if being changed
            if (isset($data['node_type']) && $data['node_type'] !== $node->node_type) {
                $this->validateNodeType($data['node_type']);
                
                // Ensure node doesn't have children if changing to partida
                if ($data['node_type'] === 'partida' && $node->children()->count() > 0) {
                    throw new \InvalidArgumentException('Cannot change node to partida type when it has children');
                }
            }

            // Update basic attributes
            $updateData = [];
            foreach (['name', 'node_type', 'unit', 'numbering'] as $field) {
                if (isset($data[$field])) {
                    $updateData[$field] = $data[$field];
                }
            }

            if (!empty($updateData)) {
                $node->update($updateData);
            }

            // Update values if provided
            if (isset($data['values']) && is_array($data['values'])) {
                $this->updateNodeValues($nodeId, $data['values']);
            }

            Log::info('TreeService: Node updated', [
                'node_id' => $nodeId,
                'updated_fields' => array_keys($updateData),
            ]);

            // Reload with relationships
            return $node->fresh(['values.module', 'children']);
        });
    }

    /**
     * Delete a node and all its descendants (cascade).
     * 
     * @param string $nodeId
     * @return void
     */
    public function deleteNode(string $nodeId): void
    {
        DB::transaction(function () use ($nodeId) {
            $node = MetradoSanitariasNode::findOrFail($nodeId);

            // Get all descendant IDs for logging
            $descendants = $node->getDescendants();
            $descendantIds = $descendants->pluck('id')->toArray();

            // Delete the node (cascade will handle children due to DB foreign key)
            $node->delete();

            Log::info('TreeService: Node deleted with cascade', [
                'node_id' => $nodeId,
                'descendants_count' => count($descendantIds),
                'descendant_ids' => $descendantIds,
            ]);
        });
    }

    // ─── Private Helper Methods ──────────────────────────────────────────────

    /**
     * Build hierarchical tree structure from flat collection.
     * 
     * @param Collection $nodes
     * @param string|null $parentId
     * @return array
     */
    private function buildHierarchy(Collection $nodes, ?string $parentId = null): array
    {
        $branch = [];

        foreach ($nodes as $node) {
            if ($node->parent_id === $parentId) {
                $children = $this->buildHierarchy($nodes, $node->id);
                
                $nodeArray = [
                    'id' => $node->id,
                    'projectId' => $node->project_id,
                    'parentId' => $node->parent_id,
                    'nodeType' => $node->node_type,
                    'name' => $node->name,
                    'numbering' => $node->numbering,
                    'unit' => $node->unit,
                    'level' => $node->level,
                    'position' => $node->position,
                    'children' => $children,
                    'values' => $this->formatValues($node->values),
                    'inheritedUnit' => $node->getInheritedUnit(),
                    'createdAt' => $node->created_at?->toISOString(),
                    'updatedAt' => $node->updated_at?->toISOString(),
                ];

                $branch[] = $nodeArray;
            }
        }

        return $branch;
    }

    /**
     * Format node values as a key-value map (moduleId => value).
     * 
     * @param Collection $values
     * @return array
     */
    private function formatValues(Collection $values): array
    {
        $formatted = [];
        foreach ($values as $value) {
            $formatted[(string) $value->module_id] = (float) $value->value;
        }
        return $formatted;
    }

    /**
     * Validate that the node type is valid.
     * 
     * @param string|null $nodeType
     * @return void
     * @throws \InvalidArgumentException
     */
    private function validateNodeType(?string $nodeType): void
    {
        $validTypes = ['titulo', 'subtitulo', 'partida'];
        
        if (!$nodeType || !in_array($nodeType, $validTypes)) {
            throw new \InvalidArgumentException(
                "Invalid node type. Must be one of: " . implode(', ', $validTypes)
            );
        }
    }

    /**
     * Validate hierarchy rules (what types of children a parent can have).
     * 
     * @param string $parentId
     * @param string $childType
     * @return void
     * @throws \InvalidArgumentException
     */
    private function validateHierarchy(string $parentId, string $childType): void
    {
        $parent = MetradoSanitariasNode::find($parentId);
        
        if (!$parent) {
            throw new \InvalidArgumentException("Parent node not found: {$parentId}");
        }

        // Partida cannot have children
        if ($parent->node_type === 'partida') {
            throw new \InvalidArgumentException(
                "Cannot add children to a partida node"
            );
        }

        // Titulo and Subtitulo can have Subtitulo or Partida children
        // (all combinations are valid for these types)
    }

    /**
     * Calculate the level of a node based on its parent.
     * 
     * @param string|null $parentId
     * @return int
     */
    private function calculateLevel(?string $parentId): int
    {
        if (!$parentId) {
            return 0; // Root level
        }

        $parent = MetradoSanitariasNode::find($parentId);
        return $parent ? $parent->level + 1 : 0;
    }

    /**
     * Calculate the next position for a new node among its siblings.
     * 
     * @param int $projectId
     * @param string|null $parentId
     * @return int
     */
    private function calculateNextPosition(int $projectId, ?string $parentId): int
    {
        $maxPosition = MetradoSanitariasNode::where('project_id', $projectId)
            ->where('parent_id', $parentId)
            ->max('position');

        return ($maxPosition ?? -1) + 1;
    }

    /**
     * Create values for a node.
     * 
     * @param string $nodeId
     * @param array $values Array of ['module_id' => value]
     * @return void
     */
    private function createNodeValues(string $nodeId, array $values): void
    {
        foreach ($values as $moduleId => $value) {
            MetradoSanitariasValue::create([
                'node_id' => $nodeId,
                'module_id' => $moduleId,
                'value' => $value,
            ]);
        }
    }

    /**
     * Update values for a node.
     * 
     * @param string $nodeId
     * @param array $values Array of ['module_id' => value]
     * @return void
     */
    private function updateNodeValues(string $nodeId, array $values): void
    {
        foreach ($values as $moduleId => $value) {
            MetradoSanitariasValue::updateOrCreate(
                [
                    'node_id' => $nodeId,
                    'module_id' => $moduleId,
                ],
                [
                    'value' => $value,
                ]
            );
        }
    }
}
