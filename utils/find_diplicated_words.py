import sys
import json
import os

def cargar_json(ruta_archivo):
    """Carga un archivo JSON y maneja posibles errores de lectura."""
    if not os.path.exists(ruta_archivo):
        print(f"Error: El archivo '{ruta_archivo}' no existe.")
        sys.exit(1)
    
    try:
        with open(ruta_archivo, 'r', encoding='utf-8') as archivo:
            datos = json.load(archivo)
            if not isinstance(datos, list):
                print(f"Error: El archivo '{ruta_archivo}' debe contener una lista de objetos JSON.")
                sys.exit(1)
            return datos
    except json.JSONDecodeError as e:
        print(f"Error al decodificar el archivo '{ruta_archivo}': {e}")
        print("Asegúrese de que el archivo tenga un formato JSON válido (por ejemplo, encerrado entre corchetes [ ]).")
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
    # Validar argumentos de la línea de comandos
    if len(sys.argv) != 3:
        print("Uso incorrecto del script.")
        print("Ejemplo de uso: py file.py archivo1.json archivo2.json")
        sys.exit(1)

    ruta_json1 = sys.argv[1]
    ruta_json2 = sys.argv[2]

    # Cargar datos de ambos archivos
    datos1 = cargar_json(ruta_json1)
    datos2 = cargar_json(ruta_json2)

    # Extraer las palabras del archivo 2 para una búsqueda eficiente
    # Se omiten valores nulos o entradas que no tengan la clave 'word'
    palabras_json2 = {
        item["word"].strip().lower() 
        for item in datos2 
        if isinstance(item, dict) and "word" in item and item["word"] is not None
    }

    duplicados_encontrados = []

    # Verificar si las palabras del archivo 1 ya existen en el archivo 2
    for item in datos1:
        if isinstance(item, dict) and "word" in item and item["word"] is not None:
            palabra = item["word"].strip()
            if palabra.lower() in palabras_json2:
                duplicados_encontrados.append(palabra)

    # Mostrar resultados de la verificación
    if duplicados_encontrados:
        print(f"Se encontraron {len(duplicados_encontrados)} palabras del archivo 1 que ya existen en el archivo 2:")
        for palabra in duplicados_encontrados:
            print(f" - {palabra}")
    else:
        print("No se encontraron palabras duplicadas entre el archivo 1 y el archivo 2.")

    # Aplicar el ajuste de formato a ambos archivos
    print("\nAplicando formato de legibilidad a los archivos...")
    guardar_json_formateado(datos1, ruta_json1)
    guardar_json_formateado(datos2, ruta_json2)

if __name__ == "__main__":
    main()