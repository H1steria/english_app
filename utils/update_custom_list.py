import json
import sys


def cargar_json(ruta_archivo):
    """Carga un archivo JSON y retorna los datos."""
    try:
        with open(ruta_archivo, 'r', encoding='utf-8') as archivo:
            return json.load(archivo)
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo '{ruta_archivo}'.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error al leer '{ruta_archivo}': {e}")
        sys.exit(1)


def guardar_json_formateado(datos, ruta_archivo):
    """Guarda los datos en el archivo correspondiente con un formato legible."""
    try:
        with open(ruta_archivo, 'w', encoding='utf-8') as archivo:
            json.dump(datos, archivo, indent=1, ensure_ascii=False)
        print(f"Archivo '{ruta_archivo}' formateado y guardado.")
    except Exception as e:
        print(f"No se pudo guardar el archivo '{ruta_archivo}': {e}")


def main():
    if len(sys.argv) != 3:
        print("Uso: py file.py json1 json2")
        sys.exit(1)

    ruta_json1 = sys.argv[1]
    ruta_json2 = sys.argv[2]

    json1 = cargar_json(ruta_json1)
    json2 = cargar_json(ruta_json2)

    # Build a set of words from json1 for quick lookup
    palabras_json1 = {entrada["word"].strip().lower() for entrada in json1 if "word" in entrada}

    coincidencias = 0
    limpiezas = 0

    for entrada in json2:
        if "word" not in entrada:
            continue

        # Step 1: Remove 'custom_list' key from every entry (clean slate)
        if "custom_list" in entrada:
            del entrada["custom_list"]
            limpiezas += 1

        # Step 2: Add 'custom_list': true only if word exists in json1
        if entrada["word"].strip().lower() in palabras_json1:
            entrada["custom_list"] = True
            coincidencias += 1

    print(f"Palabras limpiadas de 'custom_list': {limpiezas}")
    print(f"Palabras marcadas con 'custom_list': {coincidencias}")

    guardar_json_formateado(json2, ruta_json2)


if __name__ == "__main__":
    main()