import os
import tempfile
import unittest

import numpy as np
from scipy.io import savemat

from app.mat.indexing import index_mat
from app.mat.reader import read_mat_slice_from_path
from app.mat.schemas import MatSliceSpec


class TestMatModule(unittest.TestCase):
    def _write_sample_mat(self):
        alpha = np.arange(4, dtype=float)
        beta = np.array([10.0, 20.0, 30.0], dtype=float)
        mach = np.array([0.1, 0.2, 0.3, 0.4, 0.5], dtype=float)

        cl = np.zeros((4, 3, 5), dtype=float)
        for i in range(4):
            for j in range(3):
                for k in range(5):
                    cl[i, j, k] = (i * 100.0) + (j * 10.0) + k

        fd, path = tempfile.mkstemp(suffix='.mat')
        os.close(fd)
        savemat(path, {
            'CL': cl,
            'alpha': alpha,
            'beta': beta,
            'mach': mach,
        })
        return path

    def test_indexing_small_mat(self):
        path = self._write_sample_mat()
        try:
            indexed = index_mat(path)
            self.assertEqual(indexed.version, 'legacy')
            by_name = {v.name: v for v in indexed.variables}
            self.assertIn('CL', by_name)

            cl = by_name['CL']
            self.assertEqual(cl.kind, 'numeric_array')
            self.assertEqual(cl.shape, [4, 3, 5])
            self.assertEqual(cl.ndim, 3)

            guessed = indexed.coords_guess.get('CL')
            self.assertIsInstance(guessed, list)
            self.assertEqual(len(guessed), 3)
        finally:
            os.remove(path)

    def test_slice_3d_with_filters(self):
        path = self._write_sample_mat()
        try:
            indexed = index_mat(path)
            spec = MatSliceSpec(
                axis_dims=[0, 2],
                coord_map={0: 'alpha', 1: 'beta', 2: 'mach'},
                filters={'beta': 1},
                max_cells=1000,
            )
            coords, values, labels = read_mat_slice_from_path(
                path,
                var_name='CL',
                slice_spec=spec,
                mat_meta=indexed.model_dump(),
            )

            self.assertEqual(values.shape, (4, 5))
            self.assertTrue(np.allclose(coords[0], np.arange(4, dtype=float)))
            self.assertTrue(np.allclose(coords[2], np.array([0.1, 0.2, 0.3, 0.4, 0.5])))
            self.assertEqual(labels[0], 'alpha')
            self.assertEqual(labels[2], 'mach')

            expected = np.array([[i * 100.0 + 10.0 + k for k in range(5)] for i in range(4)])
            self.assertTrue(np.allclose(values, expected))
        finally:
            os.remove(path)


if __name__ == '__main__':
    unittest.main()
